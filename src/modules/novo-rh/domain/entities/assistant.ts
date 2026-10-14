/** Contrato com `/api/novo-rh/assistant` (backend, módulo assistant — ADR-0038). */

export interface AssistantScreenContext {
  rosterId: string;
  from: string;
  to: string;
}

export interface ChatTurn {
  role: "user" | "assistant";
  text: string;
}

export interface AppliedBatch {
  label: string;
  created: { id: string; employeeId: string; workDate: string }[];
  removed: { id: string; employeeId: string; workDate: string }[];
  from: string;
  to: string;
}

export interface AssistantReply {
  status: "answer" | "done" | "needs_confirmation" | "publish_flow" | "unavailable";
  text: string;
  facts: string[];
  applied: AppliedBatch | null;
  templatesChanged: boolean;
  confirmation: { token: string; summary: string } | null;
  context: { rosterName: string; from: string; to: string; pending: number };
}

export interface AssistantStatus {
  available: boolean;
  voice: boolean;
}
