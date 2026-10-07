import { ApiError, apiGet, apiPost, apiPostFormData } from "../../../../lib/api.ts";
import {
  PortalNotFoundError,
  PortalRequestError,
  type MyRequest,
  type NewRequest,
  PortalNotLinkedError,
  PortalOfflineError,
  PunchRefusedError,
  type ClientLocation,
  type Coworker,
  type MyDocument,
  type MyLeave,
  type MyShift,
  type PortalHome,
  type PunchKind,
  type PunchResult,
} from "../../domain/entities/portal.ts";
import type { PortalApiPort } from "../../domain/ports/out/portal-api.port.ts";

function translate(e: unknown): unknown {
  if (e instanceof ApiError) {
    const data = (e.data ?? {}) as { code?: string; details?: Record<string, unknown> };
    if (e.status === 403 && data.code === "PORTAL_NOT_LINKED") return new PortalNotLinkedError();
    if (e.status === 404) return new PortalNotFoundError();
    if (e.status === 400 || (e.status === 409 && !data.code)) return new PortalRequestError(e.message);
    if (e.status === 409 && data.code) return new PunchRefusedError(data.code, e.message, data.details ?? {});
    return e;
  }
  // `fetch` rejeita com TypeError quando não há rede / o pedido não chega ao servidor.
  if (e instanceof TypeError) return new PortalOfflineError();
  return e;
}

async function get<T>(path: string): Promise<T> {
  try {
    return await apiGet<T>(path);
  } catch (e) {
    throw translate(e);
  }
}

export class HttpPortalApiAdapter implements PortalApiPort {
  async getHome(): Promise<PortalHome> {
    try {
      return await apiGet<PortalHome>("/api/me");
    } catch (e) {
      throw translate(e);
    }
  }

  async registerPunch(kind: PunchKind, idempotencyKey: string, location: ClientLocation | null): Promise<PunchResult> {
    try {
      return await apiPost<PunchResult>("/api/me/punches", { kind, idempotencyKey, location });
    } catch (e) {
      throw translate(e);
    }
  }

  listMyShifts(from: string, to: string): Promise<MyShift[]> {
    return get<MyShift[]>(`/api/me/shifts?from=${from}&to=${to}`);
  }

  listCoworkers(shiftId: string): Promise<Coworker[]> {
    return get<Coworker[]>(`/api/me/shifts/${encodeURIComponent(shiftId)}/coworkers`);
  }

  listMyDocuments(): Promise<MyDocument[]> {
    return get<MyDocument[]>("/api/me/documents");
  }

  async getDocumentUrl(documentId: string): Promise<string> {
    return (await get<{ url: string }>(`/api/me/documents/${encodeURIComponent(documentId)}/download-url`)).url;
  }

  getMyLeave(year: number): Promise<MyLeave> {
    return get<MyLeave>(`/api/me/leave?year=${year}`);
  }

  async replaceDocument(documentId: string, file: File, expiresAt: string | null): Promise<MyDocument> {
    const form = new FormData();
    form.append("file", file);
    if (expiresAt) form.append("expiresAt", expiresAt);
    try {
      return await apiPostFormData<MyDocument>(`/api/me/documents/${encodeURIComponent(documentId)}/replace`, form);
    } catch (e) {
      throw translate(e);
    }
  }

  listMyRequests(): Promise<MyRequest[]> {
    return get<MyRequest[]>("/api/me/requests");
  }

  async createRequest(request: NewRequest): Promise<MyRequest> {
    const form = new FormData();
    form.append("kind", request.kind);
    form.append("reasonCode", request.reasonCode);
    if (request.reasonText) form.append("reasonText", request.reasonText);
    if (request.kind === "justify_absence") {
      form.append("workShiftId", request.workShiftId);
      if (request.attachment) form.append("attachment", request.attachment);
    } else {
      form.append("startDate", request.startDate);
      form.append("endDate", request.endDate);
    }
    try {
      return await apiPostFormData<MyRequest>("/api/me/requests", form);
    } catch (e) {
      throw translate(e);
    }
  }

  async cancelRequest(requestId: string): Promise<MyRequest> {
    try {
      return await apiPost<MyRequest>(`/api/me/requests/${encodeURIComponent(requestId)}/cancel`, {});
    } catch (e) {
      throw translate(e);
    }
  }
}
