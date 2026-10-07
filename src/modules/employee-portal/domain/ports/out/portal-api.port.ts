import type { ClientLocation, Coworker, MyDocument, MyLeave, MyShift, PortalHome, PunchKind, PunchResult } from "../../entities/portal.ts";

export interface PortalApiPort {
  getHome(): Promise<PortalHome>;
  /** Lança `PunchRefusedError` (recusa de negócio), `PortalNotLinkedError` ou `PortalOfflineError` (sem rede). */
  registerPunch(kind: PunchKind, idempotencyKey: string, location: ClientLocation | null): Promise<PunchResult>;
  listMyShifts(from: string, to: string): Promise<MyShift[]>;
  /** Lança `PortalNotFoundError` se o turno não for do próprio. */
  listCoworkers(shiftId: string): Promise<Coworker[]>;
  listMyDocuments(): Promise<MyDocument[]>;
  /** URL assinada de curta duração. Lança `PortalNotFoundError` se o documento não for do próprio. */
  getDocumentUrl(documentId: string): Promise<string>;
  getMyLeave(year: number): Promise<MyLeave>;
}
