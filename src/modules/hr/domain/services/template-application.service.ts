import type {
  OccurrenceDecision,
  TemplateOccurrence,
  Weekday,
} from "../entities/shift-template.ts";

/** Presets de "Quando aplicar?" (mockup): Seg–Sex, fins de semana; "personalizado" escolhe à mão. 0 = segunda. */
export const WEEKDAY_PRESETS: Record<"weekdays" | "weekend", Weekday[]> = {
  weekdays: [0, 1, 2, 3, 4],
  weekend: [5, 6],
};

export const WEEKDAY_SHORT_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"] as const;

/** Escolha do utilizador por ocorrência no ecrã (o "Manter"/"Ignorar" do mockup não cria nada — ambos são `skip`). */
export type OccurrenceChoice = "create" | "skip" | "replace";

/**
 * Escolha inicial: as válidas são criadas (podem ser desmarcadas); conflitos
 * ficam em "Manter turno existente" até o utilizador decidir — nunca há
 * substituição silenciosa (task §5).
 */
export function initialChoice(o: TemplateOccurrence): OccurrenceChoice {
  return o.status === "valid" ? "create" : "skip";
}

/** Pode substituir? Só sobreposições cujo turno existente não tem presença (R3). */
export function canReplace(o: TemplateOccurrence): boolean {
  return o.status === "overlap" && o.existingShift !== null && !o.existingHasAttendance;
}

/** Decisões a enviar na confirmação — uma por ocorrência pré-visualizada (o backend ignora as que mudaram entretanto). */
export function buildDecisions(occurrences: readonly TemplateOccurrence[], choices: Readonly<Record<string, OccurrenceChoice>>): Record<string, OccurrenceDecision> {
  const out: Record<string, OccurrenceDecision> = {};
  for (const o of occurrences) {
    const choice = choices[o.key] ?? initialChoice(o);
    if (choice === "replace" && canReplace(o)) out[o.key] = { action: "replace", existingShiftId: o.existingShift!.id };
    else if (choice === "create" && o.status === "valid") out[o.key] = { action: "create" };
    else out[o.key] = { action: "skip" };
  }
  return out;
}

/** Quantos turnos vão ser criados (válidas marcadas + substituições). */
export function countToCreate(occurrences: readonly TemplateOccurrence[], choices: Readonly<Record<string, OccurrenceChoice>>): number {
  return Object.values(buildDecisions(occurrences, choices)).filter((d) => d.action !== "skip").length;
}

/** "Sáb, 07/11/2026" a partir de "2026-11-07" (UTC, independente do fuso do browser). */
export function formatOccurrenceDate(ymd: string): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  const weekday = WEEKDAY_SHORT_LABELS[(d.getUTCDay() + 6) % 7];
  return `${weekday}, ${ymd.slice(8, 10)}/${ymd.slice(5, 7)}/${ymd.slice(0, 4)}`;
}
