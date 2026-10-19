import { PortalRequestError } from "../../domain/entities/portal.ts";
import { missingAnswers, needsAction, type MyCustomRequest, type MyTask, type RequestForm } from "../../domain/entities/portal-engagement.ts";
import type { PortalEngagementPort } from "../../domain/ports/in/portal.ports.ts";
import type { PortalEngagementApiPort } from "../../domain/ports/out/portal-engagement-api.port.ts";

const byActionThenDate = <T extends { requiresConfirmation: boolean; readAt: string | null; confirmedAt: string | null }>(date: (x: T) => string) => (a: T, b: T) =>
  Number(needsAction(b)) - Number(needsAction(a)) || date(b).localeCompare(date(a));

export class PortalEngagementUseCase implements PortalEngagementPort {
  private readonly api: PortalEngagementApiPort;

  constructor(api: PortalEngagementApiPort) {
    this.api = api;
  }

  async inbox() {
    const [announcements, distributions] = await Promise.all([this.api.announcements(), this.api.distributions()]);
    return {
      announcements: [...announcements].sort(byActionThenDate((x) => x.publishedAt ?? "")),
      distributions: [...distributions].sort(byActionThenDate((x) => x.createdAt)),
    };
  }

  openAnnouncement(id: string) {
    return this.api.markAnnouncementRead(id);
  }

  confirmAnnouncement(id: string) {
    return this.api.confirmAnnouncement(id);
  }

  openDistribution(id: string) {
    return this.api.distributionUrl(id);
  }

  confirmDistribution(id: string) {
    return this.api.confirmDistribution(id);
  }

  async tasks(): Promise<MyTask[]> {
    const rank = (t: MyTask) => (t.status === "open" ? 0 : 1);
    return (await this.api.tasks()).sort((a, b) => rank(a) - rank(b) || (a.dueAt ?? "9999").localeCompare(b.dueAt ?? "9999"));
  }

  toggleItem(taskId: string, itemId: string, done: boolean) {
    return this.api.toggleItem(taskId, itemId, done);
  }

  completeTask(taskId: string) {
    return this.api.completeTask(taskId);
  }

  forms() {
    return this.api.forms();
  }

  async customRequests(): Promise<MyCustomRequest[]> {
    return (await this.api.customRequests()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  submitCustomRequest(form: RequestForm, answers: Record<string, string | string[]>) {
    if (missingAnswers(form, answers).length) return Promise.reject(new PortalRequestError("Responda a todas as perguntas obrigatórias."));
    return this.api.submitCustomRequest(form.id, answers);
  }

  whosIn() {
    return this.api.whosIn();
  }

  visibility() {
    return this.api.visibility();
  }

  async pendingCount() {
    const [inbox, tasks] = await Promise.all([this.inbox(), this.api.tasks()]);
    return inbox.announcements.filter(needsAction).length + inbox.distributions.filter(needsAction).length + tasks.filter((t) => t.status === "open").length;
  }
}
