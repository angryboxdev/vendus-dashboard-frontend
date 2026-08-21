import {
  apiGet,
  apiPost,
  apiPatch,
  apiPostFormData,
  apiDeleteNoContent,
  ApiError,
} from "../../../../lib/api.ts";
import type { RecurrencesApiPort } from "../../domain/ports/out/recurrences-api.port.ts";
import type {
  RecurrenceDTO,
  OccurrenceDTO,
  OccurrenceWithRecurrenceDTO,
  RecurrenceSummaryDTO,
  CreateRecurrencePayload,
  UpdateRecurrencePayload,
  MarkOccurrenceAsPaidPayload,
  ListRecurrencesParams,
  ListOccurrencesParams,
} from "../../domain/entities/recurrence.ts";

const BASE = "/api/payable-recurrences";

export class HttpRecurrencesApiAdapter implements RecurrencesApiPort {
  async getSummary(): Promise<RecurrenceSummaryDTO> {
    return apiGet(`${BASE}/summary`);
  }

  async listRecurrences(params?: ListRecurrencesParams): Promise<RecurrenceDTO[]> {
    const q = new URLSearchParams();
    if (params?.status) q.set("status", params.status);
    if (params?.type) q.set("type", params.type);
    if (params?.supplierId) q.set("supplierId", params.supplierId);
    const qs = q.toString();
    return apiGet(`${BASE}${qs ? `?${qs}` : ""}`);
  }

  async createRecurrence(payload: CreateRecurrencePayload): Promise<RecurrenceDTO> {
    return apiPost(BASE, payload);
  }

  async getRecurrence(id: string): Promise<RecurrenceDTO> {
    return apiGet(`${BASE}/${encodeURIComponent(id)}`);
  }

  async updateRecurrence(id: string, payload: UpdateRecurrencePayload): Promise<RecurrenceDTO> {
    return apiPatch(`${BASE}/${encodeURIComponent(id)}`, payload);
  }

  async pauseRecurrence(id: string): Promise<RecurrenceDTO> {
    return apiPatch(`${BASE}/${encodeURIComponent(id)}/pause`, {});
  }

  async resumeRecurrence(id: string): Promise<RecurrenceDTO> {
    return apiPatch(`${BASE}/${encodeURIComponent(id)}/resume`, {});
  }

  async closeRecurrence(id: string): Promise<RecurrenceDTO> {
    return apiPatch(`${BASE}/${encodeURIComponent(id)}/close`, {});
  }

  async uploadRecurrenceDocument(id: string, file: File): Promise<RecurrenceDTO> {
    const fd = new FormData();
    fd.append("file", file);
    return apiPostFormData(`${BASE}/${encodeURIComponent(id)}/document`, fd);
  }

  async deleteRecurrenceDocument(id: string): Promise<void> {
    await apiDeleteNoContent(`${BASE}/${encodeURIComponent(id)}/document`);
  }

  async listOccurrences(
    recurrenceId: string,
    params?: ListOccurrencesParams,
  ): Promise<OccurrenceDTO[]> {
    const q = new URLSearchParams();
    if (params?.period) q.set("period", params.period);
    if (params?.status) q.set("status", params.status);
    const qs = q.toString();
    return apiGet(
      `${BASE}/${encodeURIComponent(recurrenceId)}/occurrences${qs ? `?${qs}` : ""}`,
    );
  }

  async generateOccurrence(
    recurrenceId: string,
    year: number,
    month: number,
  ): Promise<OccurrenceDTO> {
    return apiPost(
      `${BASE}/${encodeURIComponent(recurrenceId)}/occurrences/generate`,
      { year, month },
    );
  }

  async getOccurrence(occId: string): Promise<OccurrenceDTO> {
    return apiGet(`${BASE}/occurrences/${encodeURIComponent(occId)}`);
  }

  async getOccurrenceByInvoiceId(invoiceId: string): Promise<OccurrenceWithRecurrenceDTO | null> {
    try {
      return await apiGet<OccurrenceWithRecurrenceDTO>(
        `${BASE}/occurrences/by-invoice/${encodeURIComponent(invoiceId)}`,
      );
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) return null;
      throw err;
    }
  }

  async linkInvoiceToOccurrence(occId: string, invoiceId: string): Promise<OccurrenceDTO> {
    return apiPatch(
      `${BASE}/occurrences/${encodeURIComponent(occId)}/link-invoice`,
      { invoiceId },
    );
  }

  async markOccurrenceAsPaid(
    occId: string,
    payload?: MarkOccurrenceAsPaidPayload,
  ): Promise<OccurrenceDTO> {
    return apiPatch(
      `${BASE}/occurrences/${encodeURIComponent(occId)}/pay`,
      payload ?? {},
    );
  }

  async cancelOccurrence(occId: string): Promise<void> {
    await apiDeleteNoContent(`${BASE}/occurrences/${encodeURIComponent(occId)}`);
  }

  async getLinkedInvoiceIds(): Promise<string[]> {
    return apiGet(`${BASE}/occurrences/linked-invoice-ids`);
  }

  async uploadOccurrenceDocument(occId: string, file: File): Promise<OccurrenceDTO> {
    const fd = new FormData();
    fd.append("file", file);
    return apiPostFormData(
      `${BASE}/occurrences/${encodeURIComponent(occId)}/document`,
      fd,
    );
  }

  async deleteOccurrenceDocument(occId: string): Promise<void> {
    await apiDeleteNoContent(
      `${BASE}/occurrences/${encodeURIComponent(occId)}/document`,
    );
  }
}
