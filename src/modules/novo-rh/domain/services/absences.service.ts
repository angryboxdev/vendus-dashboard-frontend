import type { AbsenceRequest, AbsenceTypeInput, Balance, FlowLevel } from "../entities/absences.ts";

/** Tipo novo com os valores seguros (ADR-0028): pede aprovação, sem limite, sem valores legais. */
export function emptyType(): AbsenceTypeInput {
  return {
    name: "",
    code: null,
    color: null,
    category: "permission",
    unit: "days",
    counting: "working",
    limitAmount: null,
    renewal: "calendar_year",
    allowNegative: false,
    carryOver: false,
    requiresApproval: true,
    private: false,
    hiddenFromEmployee: false,
    attachment: "none",
    timeImpact: "reduce_theoretical",
    intersectSchedule: true,
    halfDay: false,
    minConsecutive: null,
    maxConsecutive: null,
    blockedDates: [],
    paid: true,
    flowId: null,
  };
}

/** "5 dias" / "2,5 h" (pt-PT). */
export function formatAmount(amount: number, unit: "days" | "hours"): string {
  const n = amount.toLocaleString("pt-PT", { maximumFractionDigits: 2 });
  return unit === "days" ? `${n} ${Math.abs(amount) === 1 ? "dia" : "dias"}` : `${n} h`;
}

/**
 * Barra do saldo (só visual, a partir do que o ledger já devolve): gozado e
 * pendente face ao direito do período (atribuído + ajustes). Tipos sem limite
 * ou sem direito não têm barra.
 */
export function balanceUsage(b: Pick<Balance, "limited" | "accrued" | "adjusted" | "used" | "pending">): { used: number; pending: number } | null {
  const total = b.accrued + b.adjusted;
  if (!b.limited || total <= 0) return null;
  const used = Math.min(1, Math.max(0, b.used / total));
  return { used, pending: Math.min(1 - used, Math.max(0, b.pending / total)) };
}

/** Período do pedido para mostrar: "19/10 – 23/10/2026" ou "19/10/2026 09:00–12:00". */
export function formatPeriod(r: Pick<AbsenceRequest, "startDate" | "endDate" | "startTime" | "endTime" | "halfDay">): string {
  const d = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
  if (r.startTime && r.endTime) return `${d(r.startDate)} ${r.startTime}–${r.endTime}`;
  const base = r.startDate === r.endDate ? d(r.startDate) : `${d(r.startDate).slice(0, 5)} – ${d(r.endDate)}`;
  return r.halfDay ? `${base} (meio dia)` : base;
}

/** CF-5 no ecrã: um nível sem pessoas nem papéis não deixa gravar. */
export function flowProblems(levels: FlowLevel[]): number[] {
  return levels.map((l, i) => (l.people.length || l.roles.length ? -1 : i + 1)).filter((i) => i > 0);
}
