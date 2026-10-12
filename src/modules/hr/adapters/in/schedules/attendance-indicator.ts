import type { WorkShift } from "../../../domain/entities/schedule.ts";

const INDICATOR: Record<string, { className: string; label: string }> = {
  worked_as_planned: { className: "bg-emerald-500", label: "Presença conferida" },
  late: { className: "bg-amber-500", label: "Atraso" },
  left_early: { className: "bg-amber-500", label: "Saída antecipada" },
  cancelled: { className: "bg-ink-muted", label: "Cancelado" },
};

/** Ponto de presença no cartão do turno (só quando a presença já foi conferida). */
export const attendanceIndicator = (s: Pick<WorkShift, "attendanceStatus">) => (s.attendanceStatus ? (INDICATOR[s.attendanceStatus] ?? { className: "bg-ink-muted", label: "Presença registada" }) : undefined);
