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
