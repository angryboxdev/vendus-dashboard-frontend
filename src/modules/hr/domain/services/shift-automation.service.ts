import type { AutomationGenerationResult, ShiftAutomation } from "../entities/shift-automation.ts";
import type { ApplicationAudience, Weekday } from "../entities/shift-template.ts";
import { WEEKDAY_SHORT_LABELS } from "./template-application.service.ts";

/** Recorrência mostrada na lista (mockup): Diária (7 dias) · Período fixo (com fim) · Semanal. */
export function recurrenceLabel(a: Pick<ShiftAutomation, "weekdays" | "endDate">): "Diária" | "Período fixo" | "Semanal" {
  if (a.endDate) return "Período fixo";
  return a.weekdays.length === 7 ? "Diária" : "Semanal";
}

/** "Seg – Sex", "Sáb, Dom", "Seg – Dom", "Seg, Qua, Sex". */
export function weekdaysLabel(weekdays: readonly Weekday[]): string {
  const sorted = [...new Set(weekdays)].sort();
  if (sorted.length === 0) return "—";
  const contiguous = sorted.every((d, i) => i === 0 || d === sorted[i - 1]! + 1);
  if (contiguous && sorted.length >= 3) return `${WEEKDAY_SHORT_LABELS[sorted[0]!]} – ${WEEKDAY_SHORT_LABELS[sorted.at(-1)!]}`;
  return sorted.map((d) => WEEKDAY_SHORT_LABELS[d]).join(", ");
}

/** "Cargo · Preparador", "Local · MBS", "Todos os colaboradores", "3 colaboradores". */
export function audienceLabel(
  audience: ApplicationAudience,
  names: { position: (id: string) => string; location: (id: string) => string; employee: (id: string) => string },
): string {
  switch (audience.kind) {
    case "all":
      return "Todos os colaboradores";
    case "position":
      return `Cargo · ${names.position(audience.positionId)}${audience.locationId ? ` (${names.location(audience.locationId)})` : ""}`;
    case "location":
      return `Local · ${names.location(audience.locationId)}`;
    case "employees":
      return audience.employeeIds.length === 1 ? names.employee(audience.employeeIds[0]!) : `${audience.employeeIds.length} colaboradores`;
  }
}

const addDays = (ymd: string, days: number) => {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/**
 * Janela que a 1.ª geração vai cobrir (mesma regra do backend,
 * `ShiftAutomation.nextWindow`): de max(início, hoje) até min(fim, hoje +
 * horizonte). Usada para pré-visualizar antes de guardar. `null` = nada a gerar.
 */
export function firstGenerationWindow(startDate: string, endDate: string | null, horizonWeeks: number, today: string): { from: string; to: string } | null {
  const from = startDate > today ? startDate : today;
  const limit = addDays(today, horizonWeeks * 7 - 1);
  const to = endDate && endDate < limit ? endDate : limit;
  return from <= to ? { from, to } : null;
}

/** Resumo do resultado de uma geração, para feedback ao gestor. */
export function generationSummary(r: AutomationGenerationResult): string {
  if (!r.window) return "Nada por gerar — já está gerada até ao horizonte.";
  const parts = [`${r.created} turno(s) criado(s)`];
  if (r.alreadyExisting > 0) parts.push(`${r.alreadyExisting} já existiam`);
  if (r.issues > 0) parts.push(`${r.issues} por resolver em Alertas e ações`);
  return parts.join(" · ");
}
