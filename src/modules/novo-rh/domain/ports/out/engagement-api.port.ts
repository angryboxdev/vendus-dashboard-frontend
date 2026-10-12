import type {
  Alert,
  AlertRule,
  Announcement,
  AnnouncementReport,
  Audience,
  CustomRequest,
  MyAnnouncement,
  OpsTask,
  ReportDefinition,
  RequestForm,
  WhosIn,
} from "../../entities/engagement.ts";

/** Comunicados (`/api/novo-rh/announcements`, `/api/me/announcements`). */
export interface AnnouncementsApiPort {
  list(): Promise<Announcement[]>;
  create(input: { title: string; body: string; audience: Audience; requiresConfirmation: boolean }): Promise<Announcement>;
  update(id: string, patch: { title?: string; body?: string; audience?: Audience }): Promise<Announcement>;
  publish(id: string): Promise<Announcement>;
  report(id: string): Promise<AnnouncementReport>;
  mine(): Promise<MyAnnouncement[]>;
  markRead(id: string): Promise<void>;
  confirm(id: string): Promise<void>;
}

/** Alertas (`/api/novo-rh/alerts`). */
export interface AlertsApiPort {
  list(status?: "active" | "closed"): Promise<Alert[]>;
  run(): Promise<{ opened: number; closed: number; escalated: number }>;
  take(id: string): Promise<Alert>;
  close(id: string, note: string): Promise<Alert>;
  rules(): Promise<AlertRule[]>;
  createRule(input: Omit<AlertRule, "id">): Promise<AlertRule>;
}

/** Tarefas, solicitações e quem está (`/api/novo-rh/workspace`, `/api/me/*`). */
export interface WorkspaceApiPort {
  tasks(): Promise<OpsTask[]>;
  createTask(input: { title: string; description: string | null; assigneeEmployeeId: string | null; dueAt: string | null; checklist: { text: string; required: boolean }[] }): Promise<OpsTask>;
  toggleItem(taskId: string, itemId: string, done: boolean): Promise<OpsTask>;
  completeTask(taskId: string): Promise<OpsTask>;
  forms(): Promise<RequestForm[]>;
  createForm(input: Omit<RequestForm, "id" | "archived">): Promise<RequestForm>;
  requests(status?: "pending"): Promise<CustomRequest[]>;
  decide(id: string, decision: "approve" | "reject", comment: string | null): Promise<CustomRequest>;
  whosIn(): Promise<WhosIn>;
}

/** Relatórios (`/api/novo-rh/reports`). */
export interface ReportsApiPort {
  catalog(): Promise<ReportDefinition[]>;
  run(key: string, period: { from: string; to: string } | null): Promise<{ definition: ReportDefinition; rows: Record<string, string | number>[] }>;
  csv(key: string, period: { from: string; to: string } | null): Promise<Blob>;
}
