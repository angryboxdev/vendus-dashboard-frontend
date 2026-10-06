import type { ClientLocation, PortalHome, PunchKind, PunchResult } from "../../entities/portal.ts";

export interface PortalApiPort {
  getHome(): Promise<PortalHome>;
  /** Lança `PunchRefusedError` (recusa de negócio), `PortalNotLinkedError` ou `PortalOfflineError` (sem rede). */
  registerPunch(kind: PunchKind, idempotencyKey: string, location: ClientLocation | null): Promise<PunchResult>;
}
