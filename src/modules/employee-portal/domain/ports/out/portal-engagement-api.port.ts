import type { MyAnnouncement, MyCustomRequest, MyDistribution, MyTask, MyTimeBank, RequestForm, WhosIn } from "../../entities/portal-engagement.ts";

/** Rotas `/api/me/*` do Novo RH usadas pelo Portal (onda 6). */
export interface PortalEngagementApiPort {
  announcements(): Promise<MyAnnouncement[]>;
  markAnnouncementRead(id: string): Promise<void>;
  confirmAnnouncement(id: string): Promise<void>;
  distributions(): Promise<MyDistribution[]>;
  /** URL assinado; abrir conta como "aberto". */
  distributionUrl(id: string): Promise<string>;
  confirmDistribution(id: string): Promise<void>;
  tasks(): Promise<MyTask[]>;
  toggleItem(taskId: string, itemId: string, done: boolean): Promise<MyTask>;
  completeTask(taskId: string): Promise<MyTask>;
  forms(): Promise<RequestForm[]>;
  customRequests(): Promise<MyCustomRequest[]>;
  submitCustomRequest(formId: string, answers: Record<string, string | string[]>): Promise<MyCustomRequest>;
  whosIn(): Promise<WhosIn>;
  /** Lança `PortalRequestError` quando a empresa não mostra o histórico. */
  timeBank(): Promise<MyTimeBank>;
}
