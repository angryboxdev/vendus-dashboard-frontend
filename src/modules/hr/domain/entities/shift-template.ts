/**
 * Modelo de turno (RH 2.0, ticket 01) — espelho de `ShiftTemplateDTO` do
 * backend (`/api/hr/schedules/templates`). Horário reutilizável; os turnos
 * gerados copiam o horário (alterar o modelo nunca muda turnos existentes).
 */
export type ShiftTemplateKind = "direct" | "split";

export interface ShiftTemplate {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  kind: ShiftTemplateKind;
  startTime: string;
  endTime: string;
  endsNextDay: boolean;
  secondStartTime: string | null;
  secondEndTime: string | null;
  breakMinutes: number;
  /** Tempo de trabalho (períodos − pausa), em minutos. */
  workMinutes: number;
  /** Do início do 1.º período ao fim do último, em minutos. */
  spanMinutes: number;
  locationId: string | null;
  active: boolean;
  updatedAt: string;
}

export interface ShiftTemplatePayload {
  name: string;
  description: string | null;
  color: string | null;
  startTime: string;
  endTime: string;
  endsNextDay: boolean;
  secondStartTime: string | null;
  secondEndTime: string | null;
  breakMinutes: number;
  locationId: string | null;
}

export const SHIFT_TEMPLATE_KIND_LABELS: Record<ShiftTemplateKind, string> = {
  direct: "Direto",
  split: "Repartido",
};

/** Cores sugeridas para o ponto do modelo na lista/escala. */
export const SHIFT_TEMPLATE_COLORS = ["#3B82F6", "#8B5CF6", "#14B8A6", "#F59E0B", "#EF4444", "#64748B"] as const;

// ── Aplicar modelo (RH 2.0, ticket 02) — espelho de `shift-template.ports.ts` ──

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type ApplicationAudience =
  | { kind: "employees"; employeeIds: string[] }
  | { kind: "all" }
  | { kind: "position"; positionId: string; locationId?: string | null }
  | { kind: "location"; locationId: string };

export type ApplicationDays = { kind: "dates"; dates: string[] } | { kind: "range"; from: string; to: string; weekdays: Weekday[] };

export interface TemplateApplicationConfig {
  audience: ApplicationAudience;
  days: ApplicationDays;
  /** Local do turno escolhido na aplicação; null = local padrão do modelo → local principal do colaborador. */
  locationId: string | null;
}

export type OccurrenceStatus = "valid" | "duplicate" | "overlap" | "leave" | "inactive_employee" | "no_location" | "inactive_location";

export interface TemplateOccurrence {
  key: string;
  employeeId: string;
  employeeName: string;
  positionId: string | null;
  workDate: string;
  startTime: string;
  endTime: string;
  secondStartTime: string | null;
  secondEndTime: string | null;
  endsNextDay: boolean;
  locationId: string | null;
  status: OccurrenceStatus;
  holidayName: string | null;
  existingShift: { id: string; startTime: string; endTime: string; secondStartTime: string | null; secondEndTime: string | null; locationId: string } | null;
  existingHasAttendance: boolean;
}

export interface TemplateApplicationPreview {
  occurrences: TemplateOccurrence[];
  summary: { employees: number; valid: number; duplicate: number; overlap: number; unavailable: number; inactive: number; holidays: number };
}

export type OccurrenceDecision = { action: "create" | "skip" } | { action: "replace"; existingShiftId: string };

export interface ApplyTemplateResult {
  created: number;
  replaced: number;
  skipped: number;
  changed: { key: string; employeeName: string; workDate: string; status: OccurrenceStatus }[];
}

export const OCCURRENCE_STATUS_LABELS: Record<OccurrenceStatus, { label: string; cls: string }> = {
  valid: { label: "Válido", cls: "bg-emerald-50 text-emerald-700" },
  duplicate: { label: "Turno já existente", cls: "bg-stone-100 text-stone-600" },
  overlap: { label: "Conflito de horário", cls: "bg-amber-50 text-amber-700" },
  leave: { label: "Colaborador indisponível", cls: "bg-red-50 text-red-600" },
  inactive_employee: { label: "Colaborador inativo", cls: "bg-stone-100 text-stone-500" },
  no_location: { label: "Sem local", cls: "bg-stone-100 text-stone-500" },
  inactive_location: { label: "Local inativo", cls: "bg-stone-100 text-stone-500" },
};
