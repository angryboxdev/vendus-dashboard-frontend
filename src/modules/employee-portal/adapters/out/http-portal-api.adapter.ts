import { ApiError, apiGet, apiPost } from "../../../../lib/api.ts";
import {
  PortalNotLinkedError,
  PortalOfflineError,
  PunchRefusedError,
  type ClientLocation,
  type PortalHome,
  type PunchKind,
  type PunchResult,
} from "../../domain/entities/portal.ts";
import type { PortalApiPort } from "../../domain/ports/out/portal-api.port.ts";

function translate(e: unknown): unknown {
  if (e instanceof ApiError) {
    const data = (e.data ?? {}) as { code?: string; details?: Record<string, unknown> };
    if (e.status === 403 && data.code === "PORTAL_NOT_LINKED") return new PortalNotLinkedError();
    if (e.status === 409 && data.code) return new PunchRefusedError(data.code, e.message, data.details ?? {});
    return e;
  }
  // `fetch` rejeita com TypeError quando não há rede / o pedido não chega ao servidor.
  if (e instanceof TypeError) return new PortalOfflineError();
  return e;
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
}
