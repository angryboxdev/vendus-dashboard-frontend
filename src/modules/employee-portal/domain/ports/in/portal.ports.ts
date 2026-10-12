import type { MyAnnouncement, MyCustomRequest, MyDistribution, MyTask, MyTimeBank, RequestForm, WhosIn } from "../../entities/portal-engagement.ts";
import type { Coworker, GeofencePolicy, MyDocument, MyLeave, MyRequest, MyShift, NewRequest, PortalHome, PunchKind, PunchResult } from "../../entities/portal.ts";

export interface GetPortalHomePort {
  execute(): Promise<PortalHome>;
}

export interface RegisterPunchInput {
  kind: PunchKind;
  /** Política do local — com `off` a localização nem é pedida. */
  geofencePolicy: GeofencePolicy;
  /** Uma chave por intenção (toque): repetir o pedido com a mesma chave nunca cria uma segunda picagem. */
  idempotencyKey: string;
}

export interface RegisterPunchPort {
  execute(input: RegisterPunchInput): Promise<PunchResult>;
}

/** Consulta do próprio colaborador (escala, colegas, documentos, ausências). */
export interface PortalSelfServicePort {
  listShifts(from: string, to: string): Promise<MyShift[]>;
  listCoworkers(shiftId: string): Promise<Coworker[]>;
  listDocuments(): Promise<MyDocument[]>;
  documentUrl(documentId: string): Promise<string>;
  getLeave(year: number): Promise<MyLeave>;
  replaceDocument(documentId: string, file: File, expiresAt: string | null): Promise<MyDocument>;
  listRequests(): Promise<MyRequest[]>;
  createRequest(request: NewRequest): Promise<MyRequest>;
  cancelRequest(requestId: string): Promise<MyRequest>;
}

/** O que a empresa envia e pede ao colaborador (onda 6 — FE-073/074/075/076/078). */
export interface PortalEngagementPort {
  /** Comunicados e documentos enviados, os que pedem ação primeiro. */
  inbox(): Promise<{ announcements: MyAnnouncement[]; distributions: MyDistribution[] }>;
  openAnnouncement(id: string): Promise<void>;
  confirmAnnouncement(id: string): Promise<void>;
  openDistribution(id: string): Promise<string>;
  confirmDistribution(id: string): Promise<void>;
  /** Tarefas abertas primeiro, por prazo. */
  tasks(): Promise<MyTask[]>;
  toggleItem(taskId: string, itemId: string, done: boolean): Promise<MyTask>;
  completeTask(taskId: string): Promise<MyTask>;
  forms(): Promise<RequestForm[]>;
  customRequests(): Promise<MyCustomRequest[]>;
  /** Recusa no cliente se faltar um campo obrigatório (`PortalRequestError`). */
  submitCustomRequest(form: RequestForm, answers: Record<string, string | string[]>): Promise<MyCustomRequest>;
  whosIn(): Promise<WhosIn>;
  /** Secções visíveis (FE-116): o menu esconde as desligadas; a API recusa na mesma. */
  visibility(): Promise<{ whosIn: boolean }>;
  timeBank(): Promise<MyTimeBank>;
  /** Quantas coisas pedem ação (para o separador "Mais"). */
  pendingCount(): Promise<number>;
}
