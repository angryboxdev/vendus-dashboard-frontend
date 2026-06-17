import { apiGet, apiPost, apiPatch, apiDeleteNoContent } from "../../../../lib/api.ts";
import type { PayableEntriesApiPort } from "../../domain/ports/out/payable-entries-api.port.ts";
import type {
  PayableEntryDTO,
  PayableSummaryDTO,
  PayableCalendarDayDTO,
  CreatePayableEntryPayload,
  UpdatePayableEntryPayload,
  ListPayableEntriesParams,
} from "../../domain/entities/payable-entry.ts";

const BASE = "/api/payable-entries";

export class HttpPayableEntriesApiAdapter implements PayableEntriesApiPort {
  async listPayableEntries(params?: ListPayableEntriesParams): Promise<PayableEntryDTO[]> {
    const q = new URLSearchParams();
    if (params?.supplierId) q.set("supplierId", params.supplierId);
    if (params?.costCenterId) q.set("costCenterId", params.costCenterId);
    if (params?.status) q.set("status", params.status);
    if (params?.from) q.set("from", params.from);
    if (params?.to) q.set("to", params.to);
    const qs = q.toString();
    return apiGet(`${BASE}${qs ? `?${qs}` : ""}`);
  }

  async getPayableEntry(id: string): Promise<PayableEntryDTO> {
    return apiGet(`${BASE}/${encodeURIComponent(id)}`);
  }

  async createPayableEntry(payload: CreatePayableEntryPayload): Promise<PayableEntryDTO> {
    return apiPost(BASE, payload);
  }

  async updatePayableEntry(id: string, payload: UpdatePayableEntryPayload): Promise<PayableEntryDTO> {
    return apiPatch(`${BASE}/${encodeURIComponent(id)}`, payload);
  }

  async markPayableAsPaid(id: string, paidAt?: string): Promise<PayableEntryDTO> {
    return apiPatch(`${BASE}/${encodeURIComponent(id)}/paid`, paidAt ? { paidAt } : {});
  }

  async cancelPayableEntry(id: string): Promise<PayableEntryDTO> {
    return apiPatch(`${BASE}/${encodeURIComponent(id)}/cancel`, {});
  }

  async deletePayableEntry(id: string): Promise<void> {
    return apiDeleteNoContent(`${BASE}/${encodeURIComponent(id)}`);
  }

  async getPayableSummary(params?: ListPayableEntriesParams): Promise<PayableSummaryDTO> {
    const q = new URLSearchParams();
    if (params?.supplierId) q.set("supplierId", params.supplierId);
    if (params?.costCenterId) q.set("costCenterId", params.costCenterId);
    if (params?.status) q.set("status", params.status);
    if (params?.from) q.set("from", params.from);
    if (params?.to) q.set("to", params.to);
    const qs = q.toString();
    return apiGet(`${BASE}/summary${qs ? `?${qs}` : ""}`);
  }

  async getPayableCalendar(from: string, to: string): Promise<PayableCalendarDayDTO[]> {
    return apiGet(`${BASE}/calendar?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
  }
}
