import type { DreEntry, DreSectionKey, DreVatBasis } from "../entities/dre.ts";

/** Pagamentos de uma rubrica (item) da DRE, com os totais. */
export interface DreEntryGroup {
  key: string;
  label: string;
  netCents: number;
  grossCents: number;
  entries: DreEntry[];
}

export const VAT_BASIS_LABELS: Record<DreVatBasis, string> = {
  exempt: "Sem IVA",
  real: "IVA da fatura",
  estimated: "IVA estimado",
  pending: "IVA por confirmar",
};

export const ENTRY_BASIS_LABELS: Record<DreEntry["basis"], string> = {
  movement: "Categoria no movimento",
  document: "Pela fatura",
  extract: "Só pelo extrato",
};

/**
 * Os pagamentos de uma linha da DRE, agrupados pela rubrica (categoria, ou tipo do extrato), do maior
 * para o menor; dentro de cada rubrica, por data de competência. `labels`: nome de cada rubrica (os
 * filhos da linha da DRE), para os grupos terem o mesmo nome que a DRE mostra.
 */
export function groupDreEntries(entries: DreEntry[], section: DreSectionKey | "off_operation", labels: Map<string, string>): DreEntryGroup[] {
  const groups = new Map<string, DreEntryGroup>();
  for (const e of entries) {
    if (e.section !== section) continue;
    const g = groups.get(e.itemKey) ?? { key: e.itemKey, label: labels.get(e.itemKey) ?? "Sem categoria", netCents: 0, grossCents: 0, entries: [] };
    g.netCents += e.netCents;
    g.grossCents += e.grossCents;
    g.entries.push(e);
    groups.set(e.itemKey, g);
  }
  return [...groups.values()]
    .map((g) => ({ ...g, entries: [...g.entries].sort((a, b) => a.competenceDate.localeCompare(b.competenceDate) || a.paidOn.localeCompare(b.paidOn)) }))
    .sort((a, b) => b.netCents - a.netCents);
}

/** YYYY-MM-DD → DD/MM/AAAA. */
export const shortDate = (iso: string) => iso.split("-").reverse().join("/");
