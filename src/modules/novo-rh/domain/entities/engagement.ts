/** Novo RH → Fase 9: comunicados, alertas, tarefas, solicitações, quem está e relatórios. */

export type Audience = { type: "all" } | { type: "locations" | "departments" | "groups" | "employees"; ids: string[] };

export interface Announcement {
  id: string;
  status: "draft" | "published" | "archived";
  audience: Audience;
  requiresConfirmation: boolean;
  currentVersion: number;
  title: string;
  body: string;
  publishedAt: string | null;
  /** Leituras e confirmações da versão atual (null em rascunho). */
  stats?: { recipients: number; read: number; confirmed: number } | null;
}

export interface AnnouncementReport {
  announcement: Announcement;
  versions: { version: number; title: string; createdAt: string; createdBy: string }[];
  totals: { recipients: number; read: number; confirmed: number };
  rows: { employeeId: string; version: number; deliveredAt: string; readAt: string | null; confirmedAt: string | null; status: "delivered" | "read" | "confirmed" }[];
}

export interface MyAnnouncement {
  id: string;
  title: string;
  body: string;
  version: number;
  publishedAt: string | null;
  requiresConfirmation: boolean;
  readAt: string | null;
  confirmedAt: string | null;
}

export type AlertKind = "pending_absence" | "pending_correction" | "pending_reopening" | "pending_swap" | "pending_custom_request" | "contract_end" | "probation_end" | "overdue_task";

export interface AlertRule {
  id: string;
  kind: AlertKind;
  thresholdDays: number;
  owner: string;
  slaHours: number;
  escalateTo: string | null;
  enabled: boolean;
}

export interface Alert {
  id: string;
  ruleId: string;
  sourceType: string;
  sourceId: string;
  employeeId: string | null;
  title: string;
  status: "open" | "in_progress" | "closed";
  dueAt: string;
  escalatedAt: string | null;
  takenBy: string | null;
  closedBy: string | null;
  closeNote: string | null;
}

export interface ChecklistItem {
  id: string;
  text: string;
  required: boolean;
  done: boolean;
}

export interface OpsTask {
  id: string;
  title: string;
  description: string | null;
  assigneeEmployeeId: string | null;
  dueAt: string | null;
  checklist: ChecklistItem[];
  status: "open" | "done" | "cancelled";
}

export interface FormField {
  id: string;
  title: string;
  type: "single" | "multiple" | "text";
  options: string[];
  required: boolean;
}

export interface RequestForm {
  id: string;
  title: string;
  responseDays: number | null;
  fields: FormField[];
  archived: boolean;
}

export interface CustomRequest {
  id: string;
  formId: string;
  employeeId: string;
  answers: Record<string, string | string[]>;
  status: "pending" | "approved" | "rejected";
  dueAt: string | null;
  decisionComment: string | null;
  createdAt: string;
}

export interface WhosIn {
  scope: "own_location" | "organization";
  people: { employeeId: string; name: string; state: string; since: string }[];
}

export interface ReportDefinition {
  key: string;
  label: string;
  description: string;
  needsPeriod: boolean;
  columns: { key: string; label: string }[];
}
