import { ApiError, apiGet, apiWrite } from "../../../../lib/api.ts";
import type { DocumentSummary, DocumentView, InvoicingMeta, IssueDocumentInput, IssueResult, NewSeriesInput, Series } from "../../domain/entities/invoicing.ts";
import { FiscalRuleError, IssueNeedsConfirmationError } from "../../domain/errors.ts";
import type { DocumentFilter, IdGeneratorPort, InvoicingApiPort, LegalEntityOption } from "../../domain/ports/out/invoicing-api.port.ts";

const B = "/api/invoicing";

/** 409 com avisos → confirmação; 422/400/404 → mensagem do Problem Details para o formulário. */
function translate(e: unknown): never {
  if (e instanceof ApiError) {
    const body = (e.data ?? {}) as { warnings?: unknown; detail?: unknown };
    if (e.status === 409 && Array.isArray(body.warnings)) throw new IssueNeedsConfirmationError(body.warnings.map(String));
    if ((e.status === 422 || e.status === 400 || e.status === 404 || e.status === 409) && typeof body.detail === "string") throw new FiscalRuleError(body.detail);
    if (e.status === 503) throw new FiscalRuleError("Emissão indisponível: a chave de assinatura não está configurada no servidor.");
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
}

export class CryptoIdGenerator implements IdGeneratorPort {
  next() {
    return crypto.randomUUID();
  }
}
