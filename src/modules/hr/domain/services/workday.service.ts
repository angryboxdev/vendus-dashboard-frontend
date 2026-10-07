import type { WorkdayRules } from "../entities/attendance-rules.ts";

/**
 * Jornada = o que um colaborador trabalha num dia de escala, contado pelo
 * dia em que o turno começa. A limpeza depois da meia-noite pertence à
 * jornada do dia anterior. Mesma regra do backend (`workday.service.ts`).
 */
export type ShiftEquivalent = 0 | 1 | 1.5 | 2;

export function classifyWorkday(minutes: number, rules: WorkdayRules): ShiftEquivalent {
  if (minutes <= 0) return 0;
  if (minutes <= rules.standardShiftMinutes + rules.closingToleranceMinutes) return 1;
  if (minutes < rules.doubleShiftFromMinutes) return 1.5;
  return 2;
}

const toMinutes = (hm: string) => {
  const [h, m] = hm.split(":").map(Number) as [number, number];
  return h * 60 + m;
};

/** Minutos planeados de um turno (1 ou 2 períodos; noturno = fim no dia seguinte). */
export function plannedShiftMinutes(s: { startTime: string; endTime: string; endsNextDay: boolean; secondStartTime: string | null; secondEndTime: string | null }): number {
  let first = toMinutes(s.endTime) - toMinutes(s.startTime);
  if (s.endsNextDay || first <= 0) first += 24 * 60;
  const second = s.secondStartTime && s.secondEndTime ? toMinutes(s.secondEndTime) - toMinutes(s.secondStartTime) : 0;
  return first + Math.max(0, second);
}

/** Por colaborador, a equivalência da jornada do dia (só 1,5 e 2 interessam ao calendário). */
export function workdayBadges(
  dayShifts: Array<{ employeeId: string; startTime: string; endTime: string; endsNextDay: boolean; secondStartTime: string | null; secondEndTime: string | null }>,
  rules: WorkdayRules,
): Map<string, 1.5 | 2> {
  const minutes = new Map<string, number>();
  for (const s of dayShifts) minutes.set(s.employeeId, (minutes.get(s.employeeId) ?? 0) + plannedShiftMinutes(s));
  const badges = new Map<string, 1.5 | 2>();
  for (const [employeeId, m] of minutes) {
    const eq = classifyWorkday(m, rules);
    if (eq === 1.5 || eq === 2) badges.set(employeeId, eq);
  }
  return badges;
}

/** 570 → "9h30", 720 → "12h". */
export function formatHoursMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}`;
}

/** Resumo legível dos limites, para o ecrã de regras. */
export function workdayRulesSummary(rules: WorkdayRules): string {
  const one = rules.standardShiftMinutes + rules.closingToleranceMinutes;
  return `1 turno até ${formatHoursMinutes(one)} · 1,5 turnos acima disso · dupla (2 turnos) a partir de ${formatHoursMinutes(rules.doubleShiftFromMinutes)}`;
}

/** Os limites têm de fazer sentido entre si (mesma validação do backend). */
export function workdayRulesError(rules: WorkdayRules): string | null {
  if (rules.standardShiftMinutes <= 0) return "A duração de um turno tem de ser maior que zero.";
  if (rules.doubleShiftFromMinutes <= rules.standardShiftMinutes + rules.closingToleranceMinutes) {
    return "A dupla tem de começar depois da duração do turno somada à tolerância de fecho.";
  }
  return null;
}

export const SHIFT_EQUIVALENT_LABEL: Record<1.5 | 2, string> = { 1.5: "1,5", 2: "Dupla" };
