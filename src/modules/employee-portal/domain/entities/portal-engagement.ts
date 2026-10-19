/**
 * Portal — o que a empresa envia e pede ao colaborador (onda 6): comunicados,
 * documentos enviados, tarefas, solicitações, quem está e banco de horas.
 * Lê as rotas `/api/me/*` do Novo RH; o servidor filtra pela sessão.
 */
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

export interface MyDistribution {
  id: string;
  title: string;
  fileName: string;
  requiresConfirmation: boolean;
  createdAt: string;
  readAt: string | null;
  confirmedAt: string | null;
}

export interface MyTaskItem {
  id: string;
  text: string;
  required: boolean;
  done: boolean;
}

export interface MyTask {
  id: string;
  title: string;
  description: string | null;
  dueAt: string | null;
  checklist: MyTaskItem[];
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
}

export interface MyCustomRequest {
  id: string;
  formId: string;
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

/** Ainda falta algo ao colaborador: confirmar (se pedido) ou abrir. */
export const needsAction = (x: { requiresConfirmation: boolean; readAt: string | null; confirmedAt: string | null }) => (x.requiresConfirmation ? !x.confirmedAt : !x.readAt);

/** Só se conclui com os itens obrigatórios feitos (o servidor valida o mesmo). */
export const missingRequired = (t: MyTask) => t.checklist.filter((i) => i.required && !i.done);

/** Campos obrigatórios por responder (o servidor valida o mesmo). */
export function missingAnswers(form: RequestForm, answers: Record<string, string | string[]>): string[] {
  return form.fields
    .filter((f) => f.required)
    .filter((f) => {
      const v = answers[f.id];
      return Array.isArray(v) ? v.length === 0 : !v?.trim();
    })
    .map((f) => f.id);
}

/** "3h 05m" / "-1h 30m" a partir de segundos. */
export function hoursLabel(seconds: number): string {
  const sign = seconds < 0 ? "-" : "";
  const m = Math.round(Math.abs(seconds) / 60);
  return `${sign}${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
}
