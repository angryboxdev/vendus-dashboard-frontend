import {
  apiGet,
  apiPost,
  apiPatch,
  apiDeleteNoContent,
  apiPostFormData,
} from "../../../../lib/api.ts";
import type { InvoicesApiPort, AddInvoiceLinePayload } from "../../domain/ports/out/invoices-api.port.ts";
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

  async setLineDetailMode(id: string, mode: LineDetailMode): Promise<InvoiceDTO> {
    return apiPatch(`${BASE}/${encodeURIComponent(id)}/line-detail-mode`, { mode });
  }

  async deleteInvoice(id: string): Promise<void> {
    return apiDeleteNoContent(`${BASE}/${encodeURIComponent(id)}`);
  }

  async deleteLine(invoiceId: string, lineId: string): Promise<void> {
    return apiDeleteNoContent(`${BASE}/${encodeURIComponent(invoiceId)}/lines/${encodeURIComponent(lineId)}`);
  }

  async classifyLine(invoiceId: string, lineId: string, payload: ClassifyLinePayload): Promise<InvoiceLineDTO> {
    return apiPatch(
      `${BASE}/${encodeURIComponent(invoiceId)}/lines/${encodeURIComponent(lineId)}/classify`,
      payload,
    );
  }

  async importInvoice(file: File): Promise<InvoiceImportResultDTO> {
    const formData = new FormData();
    formData.append("file", file);
    return apiPostFormData(`${BASE}/import`, formData);
  }

  async confirmImportedInvoice(id: string, payload: ConfirmImportedInvoicePayload): Promise<InvoiceDTO> {
    return apiPost(`${BASE}/${encodeURIComponent(id)}/confirm`, payload);
  }

  async getInvoiceAlerts(): Promise<InvoiceAlertsDTO> {
    return apiGet(`${BASE}/alerts`);
  }

  async suggestLineClassification(supplierId: string, description?: string): Promise<SuggestClassificationResult | null> {
    const qs = description ? `?description=${encodeURIComponent(description)}` : "";
    return apiGet(`${BASE}/suggest-classification/${encodeURIComponent(supplierId)}${qs}`);
  }
}
