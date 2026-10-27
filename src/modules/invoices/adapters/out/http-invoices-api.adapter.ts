import type { EmailIntakeDTO, EmailIntakeDestination } from "../../domain/entities/email-intake.ts";
import {
  apiGet,
  apiPost,
  apiPatch,
  apiPatchNoContent,
  apiDeleteNoContent,
  apiPostFormData,
  apiPut,
} from "../../../../lib/api.ts";
import type { InvoicesApiPort, AddInvoiceLinePayload } from "../../domain/ports/out/invoices-api.port.ts";
import type { PaymentDocumentImportDTO } from "../../domain/entities/payment-document.ts";
import type {
  InvoiceDTO,
  InvoiceLineDTO,
  InvoiceStatus,
  CreateInvoicePayload,
  UpdateInvoicePayload,
  UpdateInvoiceLinePayload,
  ClassifyLinePayload,
  ListInvoicesParams,
  InvoiceImportResultDTO,
  InvoiceAlertsDTO,
  ConfirmImportedInvoicePayload,
  SuggestClassificationResult,
  LineDetailMode,
  InvoiceDocumentType,
  SetLineDeductibilityOverridePayload,
  AllocationPayload,
  InvoiceAllocationDTO,
  PayablesSummaryDTO,
  PayablesSummaryParams,
  SaveDraftResultDTO,
  StockRoutingSuggestion,
} from "../../domain/entities/invoice.ts";

const BASE = "/api/invoices";

export class HttpInvoicesApiAdapter implements InvoicesApiPort {
  async listInvoices(params?: ListInvoicesParams): Promise<InvoiceDTO[]> {
    const q = new URLSearchParams();
    if (params?.supplierId) q.set("supplierId", params.supplierId);
    if (params?.costCenterId) q.set("costCenterId", params.costCenterId);
    if (params?.status) q.set("status", params.status);
    if (params?.reconciliationStatus) q.set("reconciliationStatus", params.reconciliationStatus);
    if (params?.from) q.set("from", params.from);
    if (params?.to) q.set("to", params.to);
    if (params?.documentType) q.set("documentType", params.documentType);
    if (params?.search) q.set("search", params.search);
    const qs = q.toString();
    return apiGet(`${BASE}${qs ? `?${qs}` : ""}`);
  }

  async listInvoiceLines(): Promise<InvoiceLineDTO[]> {
    return apiGet(`${BASE}/lines`);
  }

  async addLine(invoiceId: string, payload: AddInvoiceLinePayload): Promise<InvoiceLineDTO> {
    return apiPost(`${BASE}/${encodeURIComponent(invoiceId)}/lines`, payload);
  }

  async updateLine(invoiceId: string, lineId: string, payload: UpdateInvoiceLinePayload): Promise<InvoiceLineDTO> {
    return apiPatch(`${BASE}/${encodeURIComponent(invoiceId)}/lines/${encodeURIComponent(lineId)}`, payload);
  }

  async getInvoice(id: string): Promise<InvoiceDTO> {
    return apiGet(`${BASE}/${encodeURIComponent(id)}`);
  }

  async createInvoice(payload: CreateInvoicePayload): Promise<InvoiceDTO> {
    return apiPost(BASE, payload);
  }

  async updateInvoice(id: string, payload: UpdateInvoicePayload): Promise<InvoiceDTO> {
    return apiPatch(`${BASE}/${encodeURIComponent(id)}`, payload);
  }

  async markInvoicePaid(id: string, paidAt?: string, bankAccountId?: string | null, paymentMethod?: string | null, paymentNotes?: string | null): Promise<InvoiceDTO> {
    const body: Record<string, unknown> = {};
    if (paidAt) body.paidAt = paidAt;
    if (bankAccountId != null) body.bankAccountId = bankAccountId;
    if (paymentMethod != null) body.paymentMethod = paymentMethod;
    if (paymentNotes != null) body.paymentNotes = paymentNotes;
    return apiPatch(`${BASE}/${encodeURIComponent(id)}/paid`, body);
  }

  async setInvoiceStatus(id: string, status: InvoiceStatus): Promise<InvoiceDTO> {
    return apiPatch(`${BASE}/${encodeURIComponent(id)}/status`, { status });
  }

  async setLineDetailMode(id: string, mode: LineDetailMode, confirmRemoveStockReview?: boolean): Promise<InvoiceDTO> {
    const body: Record<string, unknown> = { mode };
    if (confirmRemoveStockReview !== undefined) body.confirmRemoveStockReview = confirmRemoveStockReview;
    return apiPatch(`${BASE}/${encodeURIComponent(id)}/line-detail-mode`, body);
  }

  async deleteInvoice(id: string, confirmRemoveStockReview?: boolean): Promise<void> {
    const qs = confirmRemoveStockReview ? "?confirmRemoveStockReview=true" : "";
    return apiDeleteNoContent(`${BASE}/${encodeURIComponent(id)}${qs}`);
  }

  async deleteLine(invoiceId: string, lineId: string, confirmRemoveStockReview?: boolean): Promise<void> {
    const qs = confirmRemoveStockReview ? "?confirmRemoveStockReview=true" : "";
    return apiDeleteNoContent(`${BASE}/${encodeURIComponent(invoiceId)}/lines/${encodeURIComponent(lineId)}${qs}`);
  }

  async classifyLine(invoiceId: string, lineId: string, payload: ClassifyLinePayload): Promise<InvoiceLineDTO> {
    return apiPatch(
      `${BASE}/${encodeURIComponent(invoiceId)}/lines/${encodeURIComponent(lineId)}/classify`,
      payload,
    );
  }

  async setLineDeductibilityOverride(
    invoiceId: string,
    lineId: string,
    payload: SetLineDeductibilityOverridePayload,
  ): Promise<InvoiceLineDTO> {
    return apiPatch(
      `${BASE}/${encodeURIComponent(invoiceId)}/lines/${encodeURIComponent(lineId)}/deductibility`,
      payload,
    );
  }

  async importInvoice(file: File, documentType?: InvoiceDocumentType, options?: { treatAsInvoice?: boolean; keepDraftLines?: boolean }): Promise<InvoiceImportResultDTO | PaymentDocumentImportDTO> {
    const formData = new FormData();
    formData.append("file", file);
    if (documentType) formData.append("documentType", documentType);
    if (options?.treatAsInvoice) formData.append("treatAsInvoice", "true");
    if (options?.keepDraftLines) formData.append("keepDraftLines", "true");
    return apiPostFormData(`${BASE}/import`, formData);
  }

  async createObligationDraft(file: File, options?: { force?: boolean }): Promise<InvoiceImportResultDTO> {
    const formData = new FormData();
    formData.append("file", file);
    if (options?.force) formData.append("force", "true");
    return apiPostFormData(`${BASE}/obligations`, formData);
  }

  async linkObligation(invoiceId: string, file: File): Promise<InvoiceDTO> {
    const formData = new FormData();
    formData.append("file", file);
    return apiPostFormData(`${BASE}/${encodeURIComponent(invoiceId)}/link-obligation`, formData);
  }

  async confirmImportedInvoice(id: string, payload: ConfirmImportedInvoicePayload): Promise<InvoiceDTO> {
    return apiPost(`${BASE}/${encodeURIComponent(id)}/confirm`, payload);
  }

  async getInvoiceAlerts(): Promise<InvoiceAlertsDTO> {
    return apiGet(`${BASE}/alerts`);
  }

  async getEmailIntake(): Promise<EmailIntakeDTO> {
    return apiGet(`${BASE}/email-intake`);
  }

  async generateEmailIntakeAddress(reason?: string | null): Promise<{ email: string; createdAt: string }> {
    return apiPost(`${BASE}/email-intake/address`, { reason: reason ?? null });
  }

  async setEmailIntakeDestination(destination: EmailIntakeDestination): Promise<void> {
    await apiPatchNoContent(`${BASE}/email-intake/settings`, { destination });
  }

  async suggestLineClassification(supplierId: string, description?: string): Promise<SuggestClassificationResult | null> {
    const qs = description ? `?description=${encodeURIComponent(description)}` : "";
    return apiGet(`${BASE}/suggest-classification/${encodeURIComponent(supplierId)}${qs}`);
  }

  // ── F2 v1.2 ──────────────────────────────────────────────────────────────
  async getStockRoutingSuggestion(input: { supplierId: string | null; locationId: string | null; categoryIds: string[] }): Promise<StockRoutingSuggestion> {
    return apiPost(`${BASE}/stock-routing-suggestion`, input);
  }

  async saveInvoiceDraft(id: string, payload: ConfirmImportedInvoicePayload): Promise<SaveDraftResultDTO> {
    return apiPost(`${BASE}/${encodeURIComponent(id)}/draft`, payload);
  }

  async replaceInvoiceAllocations(id: string, allocations: AllocationPayload[], expectedVersion?: number): Promise<InvoiceDTO> {
    return apiPut(`${BASE}/${encodeURIComponent(id)}/allocations`, { allocations, ...(expectedVersion !== undefined && { expectedVersion }) });
  }

  async listInvoiceAllocations(): Promise<InvoiceAllocationDTO[]> {
    return apiGet(`${BASE}/allocations`);
  }

  async getPayablesSummary(params: PayablesSummaryParams): Promise<PayablesSummaryDTO> {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (typeof v === "string" && v.trim()) q.set(k, v.trim());
    const qs = q.toString();
    return apiGet(`${BASE}/payables-summary${qs ? `?${qs}` : ""}`);
  }
}
