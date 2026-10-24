import type { ClientLocation, Coworker, DocumentChecklist, MyDocument, NewDocumentSubmission, MyLeave, MyRequest, MyShift, NewRequest, PortalHome, PunchKind, PunchResult } from "../../entities/portal.ts";

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
  /** Envia PDF/foto para substituir um documento vencido / a vencer. Lança `PortalRequestError` com a recusa. */
  replaceDocument(documentId: string, file: File, expiresAt: string | null): Promise<MyDocument>;
  /** Para onde posso enviar e o que falta. */
  getDocumentChecklist(): Promise<DocumentChecklist>;
  /** Envia um documento novo (fica «Em validação»). Lança `PortalRequestError` com a recusa. */
  submitDocument(submission: NewDocumentSubmission): Promise<MyDocument>;
  listMyRequests(): Promise<MyRequest[]>;
  createRequest(request: NewRequest): Promise<MyRequest>;
  cancelRequest(requestId: string): Promise<MyRequest>;
}
