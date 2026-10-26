/** Uma linha de entrada: o valor de uma recorrência no mês e a categoria a que pertence. */
export interface CategoryBreakdownItem {
  categoryId: string | null;
  categoryName: string | null;
  recurrenceId: string;
  supplierName: string;
  amountCents: number;
}

export interface CategoryBreakdownRow {
  /** null = sem categoria. */
  categoryId: string | null;
  label: string;
  amountCents: number;
  /** Percentagem do total (0–100, arredondada). */
  percent: number;
  /** Largura da barra relativa à maior categoria (0–100). */
  barPercent: number;
  recurrenceCount: number;
  recurrenceIds: string[];
}

export interface CategoryBreakdown {
  rows: CategoryBreakdownRow[];
  totalCents: number;
  recurrenceCount: number;
  supplierCount: number;
}

export const NO_CATEGORY_LABEL = "Sem categoria";

/** Agrupa o valor do mês por categoria, do maior para o menor (como o resumo de categorias das faturas). */
export function buildCategoryBreakdown(items: CategoryBreakdownItem[]): CategoryBreakdown {
  const groups = new Map<string, { categoryId: string | null; label: string; amountCents: number; ids: Set<string> }>();
  for (const it of items) {
    const key = it.categoryId ?? "";
    const g = groups.get(key) ?? {
      categoryId: it.categoryId,
      label: it.categoryId ? (it.categoryName ?? NO_CATEGORY_LABEL) : NO_CATEGORY_LABEL,
      amountCents: 0,
      ids: new Set<string>(),
    };
    g.amountCents += it.amountCents;
    g.ids.add(it.recurrenceId);
    groups.set(key, g);
  }

  const totalCents = items.reduce((s, it) => s + it.amountCents, 0);
  const sorted = [...groups.values()].sort((a, b) => b.amountCents - a.amountCents || a.label.localeCompare(b.label));
  const max = sorted[0]?.amountCents ?? 0;

  return {
    rows: sorted.map((g) => ({
      categoryId: g.categoryId,
      label: g.label,
      amountCents: g.amountCents,
      percent: totalCents > 0 ? Math.round((g.amountCents / totalCents) * 100) : 0,
      barPercent: max > 0 ? (g.amountCents / max) * 100 : 0,
      recurrenceCount: g.ids.size,
      recurrenceIds: [...g.ids],
    })),
    totalCents,
    recurrenceCount: new Set(items.map((it) => it.recurrenceId)).size,
    supplierCount: new Set(items.map((it) => it.supplierName.trim().toLowerCase()).filter(Boolean)).size,
  };
}
