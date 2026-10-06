import { apiGet, apiPost, apiPatch, apiPostFormData, ApiError } from "../../../../lib/api.ts";
import type { AccountingApiPort } from "../../domain/ports/out/accounting-api.port.ts";
import type {
  AccountingDocumentDTO,
  AccountingDocumentRowDTO,
  AccountingDuplicateCandidate,
  CreateAccountingDocumentPayload,
  UpdateAccountingDocumentPayload,
  ListAccountingDocumentsParams,
} from "../../domain/entities/accounting-document.ts";
import type { VatOverviewResult } from "../../domain/entities/vat-overview.ts";
import type { AccountingSettings, UpdateAccountingSettingsPayload } from "../../domain/entities/accounting-settings.ts";
import { AccountingDuplicateError } from "../../domain/errors.ts";

const BASE = "/api/accounting";

function isDuplicateCandidate(value: unknown): value is AccountingDuplicateCandidate {
  const c = value as Partial<AccountingDuplicateCandidate> | null;
  return !!c && typeof c.id === "string" && typeof c.label === "string" && (c.source === "invoice" || c.source === "accounting_document");
}

/** Traduz o 409 `{ error, candidate }` do backend num `AccountingDuplicateError` tipado — nunca deixar o `ApiError` genérico chegar à UI para este caso. */
async function withDuplicateHandling<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (e) {
    if (e instanceof ApiError && e.status === 409) {
      const candidate = (e.data as { candidate?: unknown } | null)?.candidate;
      if (isDuplicateCandidate(candidate)) throw new AccountingDuplicateError(candidate);
    }
    throw e;
  }
}

export class HttpAccountingApiAdapter implements AccountingApiPort {
  async listAccountingDocuments(params?: ListAccountingDocumentsParams): Promise<AccountingDocumentRowDTO[]> {
    const q = new URLSearchParams();
    if (params?.from) q.set("from", params.from);
    if (params?.to) q.set("to", params.to);
    const qs = q.toString();
    return apiGet(`${BASE}/documents${qs ? `?${qs}` : ""}`);
  }

  async getAccountingDocument(id: string): Promise<AccountingDocumentDTO> {
    return apiGet(`${BASE}/documents/${encodeURIComponent(id)}`);
  }

  async createAccountingDocument(payload: CreateAccountingDocumentPayload): Promise<AccountingDocumentDTO> {
    return withDuplicateHandling(() => apiPost(`${BASE}/documents`, payload));
  }

  async updateAccountingDocument(id: string, payload: UpdateAccountingDocumentPayload): Promise<AccountingDocumentDTO> {
    return withDuplicateHandling(() => apiPatch(`${BASE}/documents/${encodeURIComponent(id)}`, payload));
  }

  async validateAccountingDocument(id: string): Promise<AccountingDocumentDTO> {
    return apiPost(`${BASE}/documents/${encodeURIComponent(id)}/validate`, {});
  }

  async markAccountingDocumentPendency(id: string): Promise<AccountingDocumentDTO> {
    return apiPost(`${BASE}/documents/${encodeURIComponent(id)}/mark-pendency`, {});
  }

  async cancelAccountingDocument(id: string, reason: string): Promise<AccountingDocumentDTO> {
    return apiPost(`${BASE}/documents/${encodeURIComponent(id)}/cancel`, { reason });
  }

  async uploadAccountingDocumentAttachment(id: string, file: File): Promise<AccountingDocumentDTO> {
    const formData = new FormData();
    formData.append("file", file);
    return apiPostFormData(`${BASE}/documents/${encodeURIComponent(id)}/attachment`, formData);
  }

  async getVatOverview(year: number, period: number): Promise<VatOverviewResult> {
    const q = new URLSearchParams({ year: String(year), period: String(period) });
    return apiGet(`${BASE}/vat-overview?${q.toString()}`);
  }

  async getAccountingSettings(): Promise<AccountingSettings> {
    return apiGet(`${BASE}/settings`);
  }

  async updateAccountingSettings(payload: UpdateAccountingSettingsPayload): Promise<AccountingSettings> {
    return apiPatch(`${BASE}/settings`, payload);
  }
}
