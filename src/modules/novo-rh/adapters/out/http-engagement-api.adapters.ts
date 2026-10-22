import { apiDeleteNoContent, apiGet, apiGetBlob, apiWrite, apiPostFormDataFile } from "../../../../lib/api.ts";
import type { Alert, AlertRule, Announcement, AnnouncementReport, Audience, CustomRequest, MyAnnouncement, OpsTask, ReportDefinition, ReportParams, ReportResult, RequestForm, WhosIn, AttendanceDaysQuery, AttendanceDaysResult, ExportTable } from "../../domain/entities/engagement.ts";
import type { AlertsApiPort, AnnouncementsApiPort, ReportsApiPort, WorkspaceApiPort } from "../../domain/ports/out/engagement-api.port.ts";

const qs = (o: Record<string, string | undefined>) => new URLSearchParams(Object.entries(o).filter((e): e is [string, string] => !!e[1])).toString();

export class HttpAnnouncementsApiAdapter implements AnnouncementsApiPort {
  private readonly A = "/api/novo-rh/announcements";
  list() {
    return apiGet<Announcement[]>(this.A);
  }
  async create(input: { title: string; body: string; audience: Audience; requiresConfirmation: boolean }) {
    return (await apiWrite<Announcement>(this.A, { body: input })).data;
  }
  async update(id: string, patch: { title?: string; body?: string; audience?: Audience }) {
    return (await apiWrite<Announcement>(`${this.A}/${id}`, { method: "PATCH", body: patch })).data;
  }
  async publish(id: string) {
    return (await apiWrite<Announcement>(`${this.A}/${id}/publish`, {})).data;
  }
  report(id: string) {
    return apiGet<AnnouncementReport>(`${this.A}/${id}/report`);
  }
  async archive(id: string) {
    await apiWrite(`${this.A}/${id}/archive`, {});
  }
  async duplicate(id: string) {
    return (await apiWrite<Announcement>(`${this.A}/${id}/duplicate`, {})).data;
  }
  async deleteDraft(id: string) {
    await apiDeleteNoContent(`${this.A}/${id}`);
  }
  async previewAudience(audience: Audience) {
    return (await apiWrite<{ recipients: number; withoutAccount: number }>(`${this.A}/audience-preview`, { body: { audience } })).data;
  }
  async remind(id: string) {
    return (await apiWrite<{ pending: number; notified: number; withoutAccount: number }>(`${this.A}/${id}/remind`, {})).data;
  }
  proofCsv(id: string) {
    return apiGetBlob(`${this.A}/${id}/proof.csv`);
  }
  mine() {
    return apiGet<MyAnnouncement[]>("/api/me/announcements");
  }
  async markRead(id: string) {
    await apiWrite(`/api/me/announcements/${id}/read`, {});
  }
  async confirm(id: string) {
    await apiWrite(`/api/me/announcements/${id}/confirm`, {});
  }
}

export class HttpAlertsApiAdapter implements AlertsApiPort {
  private readonly A = "/api/novo-rh/alerts";
  list(status?: "active" | "closed") {
    return apiGet<Alert[]>(`${this.A}?${qs({ status })}`);
  }
  async run() {
    return (await apiWrite<{ opened: number; closed: number; escalated: number }>(`${this.A}/run`, {})).data;
  }
  async take(id: string) {
    return (await apiWrite<Alert>(`${this.A}/${id}/take`, {})).data;
  }
  async close(id: string, note: string) {
    return (await apiWrite<Alert>(`${this.A}/${id}/close`, { body: { note } })).data;
  }
  rules() {
    return apiGet<AlertRule[]>(`${this.A}/rules`);
  }
  async createRule(input: Omit<AlertRule, "id">) {
    return (await apiWrite<AlertRule>(`${this.A}/rules`, { body: input })).data;
  }
}

export class HttpWorkspaceApiAdapter implements WorkspaceApiPort {
  private readonly W = "/api/novo-rh/workspace";
  tasks() {
    return apiGet<OpsTask[]>(`${this.W}/tasks`);
  }
  async createTask(input: { title: string; description: string | null; assigneeEmployeeId: string | null; dueAt: string | null; checklist: { text: string; required: boolean }[] }) {
    return (await apiWrite<OpsTask>(`${this.W}/tasks`, { body: input })).data;
  }
  async toggleItem(taskId: string, itemId: string, done: boolean) {
    return (await apiWrite<OpsTask>(`${this.W}/tasks/${taskId}/items/${itemId}`, { body: { done } })).data;
  }
  async completeTask(taskId: string) {
    return (await apiWrite<OpsTask>(`${this.W}/tasks/${taskId}/complete`, {})).data;
  }
  forms() {
    return apiGet<RequestForm[]>(`${this.W}/forms`);
  }
  async createForm(input: Omit<RequestForm, "id" | "archived">) {
    return (await apiWrite<RequestForm>(`${this.W}/forms`, { body: input })).data;
  }
  requests(status?: "pending") {
    return apiGet<CustomRequest[]>(`${this.W}/requests?${qs({ status })}`);
  }
  async decide(id: string, decision: "approve" | "reject", comment: string | null) {
    return (await apiWrite<CustomRequest>(`${this.W}/requests/${id}/decide`, { body: { decision, comment } })).data;
  }
  whosIn() {
    return apiGet<WhosIn>("/api/me/whos-in");
  }
}

export class HttpReportsApiAdapter implements ReportsApiPort {
  private readonly R = "/api/novo-rh/reports";
  catalog() {
    return apiGet<ReportDefinition[]>(this.R);
  }
  private query(p: ReportParams) {
    const list = (v: string[]) => (v.length ? v.join(",") : undefined);
    return qs({ from: p.period?.from, to: p.period?.to, locations: list(p.locationIds), employees: list(p.employeeIds), columns: list(p.columns) });
  }
  run(key: string, params: ReportParams) {
    return apiGet<ReportResult>(`${this.R}/${key}?${this.query(params)}`);
  }
  csv(key: string, params: ReportParams) {
    return apiGetBlob(`${this.R}/${key}/csv?${this.query(params)}`);
  }
  attendanceDays(q: AttendanceDaysQuery) {
    const list = (v: string[]) => (v.length ? v.join(",") : undefined);
    return apiGet<AttendanceDaysResult>(`${this.R}/attendance/days?${qs({ from: q.from, to: q.to, locations: list(q.locationIds), groups: list(q.groupIds), departments: list(q.departmentIds), employees: list(q.employeeIds) })}`);
  }
  exportXlsx(table: ExportTable) {
    const form = new FormData();
    form.append("table", JSON.stringify(table));
    return apiPostFormDataFile(`${this.R}/export/xlsx`, form);
  }
}
