import type { PayslipMappingEntry, PayslipPreviewRow } from "../entities/payslip-import.ts";

/** "2026-09" → "09/2026" (como a task mostra o período). */
export function formatPeriod(period: string | null): string {
  if (!period) return "—";
  const [year, month] = period.split("-");
  return `${month}/${year}`;
}

/** Período por omissão da importação: o mês anterior ao de `today` (os recibos chegam depois do fecho do mês). */
export function defaultPayslipPeriod(today: string): string {
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  return month === 1 ? `${year - 1}-12` : `${year}-${String(month - 1).padStart(2, "0")}`;
}

/**
 * O que o utilizador decidiu para cada ficheiro da pré-visualização:
 * - `create` — importar para `employeeId`;
 * - `replace` — "Substituir versão" do recibo já existente;
 * - `skip` — não importar ("Cancelar", ou ainda por rever).
 */
export interface PayslipDecision {
  employeeId: string | null;
  action: "create" | "replace" | "skip";
}

/**
 * Decisão inicial: só o identificado é importado sem intervenção. Um
 * duplicado nunca é substituído sem o utilizador escolher (task §26) e um
 * "Rever" nunca é associado automaticamente (§24).
 */
export function initialPayslipDecision(row: PayslipPreviewRow): PayslipDecision {
  if (row.status === "identified") return { employeeId: row.employeeId, action: "create" };
  if (row.status === "duplicate") return { employeeId: row.employeeId, action: "skip" };
  return { employeeId: null, action: "skip" };
}

/** Mapeamento a enviar ao backend + erros que impedem a confirmação. */
export function buildPayslipMapping(
  rows: readonly PayslipPreviewRow[],
  decisions: Readonly<Record<string, PayslipDecision>>,
  employeeName: (id: string) => string,
): { mapping: PayslipMappingEntry[]; errors: string[] } {
  const mapping: PayslipMappingEntry[] = [];
  for (const row of rows) {
    const d = decisions[row.fileName];
    if (!d || d.action === "skip" || !d.employeeId) continue;
    mapping.push({ fileName: row.fileName, employeeId: d.employeeId, action: d.action });
  }
  const counts = new Map<string, number>();
  for (const m of mapping) counts.set(m.employeeId, (counts.get(m.employeeId) ?? 0) + 1);
  const errors = [...counts.entries()]
    .filter(([, n]) => n > 1)
    .map(([id]) => `${employeeName(id)} tem mais de um recibo neste período — escolha só um.`);
  return { mapping, errors };
}
