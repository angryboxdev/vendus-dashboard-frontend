import { ApiError, apiDeleteNoContent, apiGet, apiGetBlob, apiWrite } from "../../../../lib/api.ts";
import type { AtCommunication, AtCredentialsInput, AtStatus, CommunicateResult, DocumentSummary, DocumentView, InvoicingMeta, IssueDocumentInput, IssueResult, NewSeriesInput, SaftQuery, Series } from "../../domain/entities/invoicing.ts";
import { FiscalRuleError, IssueNeedsConfirmationError } from "../../domain/errors.ts";
import type { DocumentFilter, FileSaverPort, IdGeneratorPort, InvoicingApiPort, IssuerSyncResult, LegalEntityOption } from "../../domain/ports/out/invoicing-api.port.ts";

const B = "/api/invoicing";

/** 409 com avisos → confirmação; 422/400/404 → mensagem do Problem Details para o formulário. */
function translate(e: unknown): never {
  if (e instanceof ApiError) {
    const body = (e.data ?? {}) as { warnings?: unknown; detail?: unknown };
    if (e.status === 409 && Array.isArray(body.warnings)) throw new IssueNeedsConfirmationError(body.warnings.map(String));
    if ((e.status === 422 || e.status === 400 || e.status === 404 || e.status === 409) && typeof body.detail === "string") throw new FiscalRuleError(body.detail);
    // 503: emissão (chave) ou comunicação com a AT (certificado, AT em baixo) indisponível — o detalhe diz qual.
    if (e.status === 503) throw new FiscalRuleError(typeof body.detail === "string" ? body.detail : "Serviço indisponível de momento.");
  }
  throw e;
}

async function write<T>(path: string, body: unknown, idempotencyKey: string, method: "POST" | "PUT" = "POST"): Promise<T> {
  try {
    return (await apiWrite<T>(path, { method, body, idempotencyKey })).data;
  } catch (e) {
    translate(e);
  }
}

export class HttpInvoicingApiAdapter implements InvoicingApiPort {
  meta() {
    return apiGet<InvoicingMeta>(`${B}/meta`);
  }
  listSeries() {
    return apiGet<Series[]>(`${B}/series`);
  }
  createSeries(input: NewSeriesInput, key: string) {
    return write<Series>(`${B}/series`, input, key);
  }
  setValidationCode(seriesRef: string, validationCode: string, key: string) {
    return write<Series>(`${B}/series/${encodeURIComponent(seriesRef)}/validation-code`, { validationCode }, key, "PUT");
  }
  listDocuments(filter: DocumentFilter) {
    const q = new URLSearchParams(Object.entries(filter).filter(([, v]) => v) as [string, string][]);
    return apiGet<DocumentSummary[]>(`${B}/documents${q.size ? `?${q}` : ""}`);
  }
  getDocument(id: string) {
    return apiGet<DocumentView>(`${B}/documents/${encodeURIComponent(id)}`);
  }
  issue(input: IssueDocumentInput, key: string) {
    return write<IssueResult>(`${B}/documents`, input, key);
  }
  cancel(id: string, reasonCode: string, note: string | undefined, key: string) {
    return write<DocumentView>(`${B}/documents/${encodeURIComponent(id)}/cancel`, { reasonCode, ...(note ? { note } : {}) }, key);
  }
  async legalEntities(): Promise<LegalEntityOption[]> {
    const list = await apiGet<Array<{ id: string; name: string; taxId: string }>>("/api/novo-rh/legal-entities");
    return list.map(({ id, name, taxId }) => ({ id, name, taxId }));
  }
  syncIssuerFromCompany() {
    return write<IssuerSyncResult>("/api/organization/issuer-sync", {}, crypto.randomUUID());
  }
  atStatus() {
    return apiGet<AtStatus>(`${B}/at`);
  }
  async saveAtCredentials(legalEntityId: string, credentials: AtCredentialsInput) {
    await write<unknown>(`${B}/at/credentials/${encodeURIComponent(legalEntityId)}`, credentials, crypto.randomUUID(), "PUT");
  }
  async removeAtCredentials(legalEntityId: string) {
    try {
      await apiDeleteNoContent(`${B}/at/credentials/${encodeURIComponent(legalEntityId)}`);
    } catch (e) {
      translate(e);
    }
  }
  communicateAt(force: boolean) {
    return write<CommunicateResult>(`${B}/at/communicate`, { force }, crypto.randomUUID());
  }
  documentAtCommunications(documentId: string) {
    return apiGet<AtCommunication[]>(`${B}/at/documents/${encodeURIComponent(documentId)}`);
  }
  registerSeriesAt(seriesRef: string, credentials: AtCredentialsInput) {
    return write<Series>(`${B}/at/series/${encodeURIComponent(seriesRef)}/register`, credentials, crypto.randomUUID());
  }
  async finalizeSeriesAt(seriesRef: string, credentials: AtCredentialsInput, justification?: string) {
    await write<unknown>(`${B}/at/series/${encodeURIComponent(seriesRef)}/finalize`, { ...credentials, ...(justification ? { justification } : {}) }, crypto.randomUUID());
  }
  async cancelSeriesAt(seriesRef: string, credentials: AtCredentialsInput) {
    await write<unknown>(`${B}/at/series/${encodeURIComponent(seriesRef)}/cancel`, credentials, crypto.randomUUID());
  }
  async exportSaft(q: SaftQuery): Promise<Blob> {
    const params = new URLSearchParams({ legalEntityId: q.legalEntityId, from: q.from, to: q.to, ...(q.includeTraining ? { training: "1" } : {}) });
    try {
      return await apiGetBlob(`${B}/saft?${params}`);
    } catch (e) {
      translate(e);
    }
  }
}

/** Descarga no browser (SAF-T). */
export class BrowserFileSaver implements FileSaverPort {
  save(fileName: string, content: Blob) {
    const url = URL.createObjectURL(content);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

export class CryptoIdGenerator implements IdGeneratorPort {
  next() {
    return crypto.randomUUID();
  }
}
