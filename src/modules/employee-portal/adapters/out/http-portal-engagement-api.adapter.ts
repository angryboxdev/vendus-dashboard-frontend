import { ApiError, apiGet, apiWrite } from "../../../../lib/api.ts";
import { PortalNotFoundError, PortalNotLinkedError, PortalOfflineError, PortalRequestError } from "../../domain/entities/portal.ts";
import type { MyAnnouncement, MyCustomRequest, MyDistribution, MyTask, MyTimeBank, RequestForm, WhosIn } from "../../domain/entities/portal-engagement.ts";
import type { PortalEngagementApiPort } from "../../domain/ports/out/portal-engagement-api.port.ts";

/** Erros RFC 7807 do Novo RH → erros do Portal (mensagem do servidor, nunca o corpo cru). */
function translate(e: unknown): unknown {
  if (e instanceof ApiError) {
    const data = (e.data ?? {}) as { code?: string };
    if (e.status === 403 && data.code === "PORTAL_NOT_LINKED") return new PortalNotLinkedError();
    if (e.status === 404) return new PortalNotFoundError();
    if (e.status >= 400 && e.status < 500) return new PortalRequestError(e.message);
    return e;
  }
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

async function write<T>(path: string, body: unknown = {}): Promise<T> {
  try {
    return (await apiWrite<T>(path, { body })).data;
  } catch (e) {
    throw translate(e);
  }
}

const enc = encodeURIComponent;

export class HttpPortalEngagementApiAdapter implements PortalEngagementApiPort {
  announcements() {
    return get<MyAnnouncement[]>("/api/me/announcements");
  }
  async markAnnouncementRead(id: string) {
    await write(`/api/me/announcements/${enc(id)}/read`);
  }
  async confirmAnnouncement(id: string) {
    await write(`/api/me/announcements/${enc(id)}/confirm`);
  }
  distributions() {
    return get<MyDistribution[]>("/api/me/document-distributions");
  }
  async distributionUrl(id: string) {
    return (await get<{ url: string }>(`/api/me/document-distributions/${enc(id)}/download-url`)).url;
  }
  async confirmDistribution(id: string) {
    await write(`/api/me/document-distributions/${enc(id)}/confirm`);
  }
  tasks() {
    return get<MyTask[]>("/api/me/ops-tasks");
  }
  toggleItem(taskId: string, itemId: string, done: boolean) {
    return write<MyTask>(`/api/me/ops-tasks/${enc(taskId)}/items/${enc(itemId)}`, { done });
  }
  completeTask(taskId: string) {
    return write<MyTask>(`/api/me/ops-tasks/${enc(taskId)}/complete`);
  }
  forms() {
    return get<RequestForm[]>("/api/me/custom-requests/forms");
  }
  customRequests() {
    return get<MyCustomRequest[]>("/api/me/custom-requests");
  }
  submitCustomRequest(formId: string, answers: Record<string, string | string[]>) {
    return write<MyCustomRequest>("/api/me/custom-requests", { formId, answers });
  }
  whosIn() {
    return get<WhosIn>("/api/me/whos-in");
  }
  timeBank() {
    return get<MyTimeBank>("/api/me/time-bank");
  }
}
