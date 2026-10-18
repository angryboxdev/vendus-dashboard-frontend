import type { AllocationPayload, InvoiceAllocationDTO } from "../entities/invoice.ts";
import { typedToCents } from "./draft-amounts.ts";

/** Repartição «Por valores» em edição (F2 v1.2 §2.2): montante líquido em euros, como escrito. */
export interface DraftAllocation {
  key: string;
  description: string;
  groupId: string | null;
  categoryId: string | null;
  locationId: string | null;
  amount: string;
}

export interface AllocationsState {
  distributedCents: number;
  /** «Por distribuir» = base líquida − soma (negativo = excesso). */
  remainingCents: number;
  /** Linhas com descrição, subcategoria e montante > 0. */
  rowsComplete: boolean;
  ok: boolean;
}

export function newDraftAllocation(key: string): DraftAllocation {
  return { key, description: "", groupId: null, categoryId: null, locationId: null, amount: "" };
}

export function allocationsState(rows: DraftAllocation[], netBaseCents: number): AllocationsState {
  const cents = rows.map((r) => typedToCents(r.amount) ?? 0);
  const distributedCents = cents.reduce((a, b) => a + (b > 0 ? b : 0), 0);
  const remainingCents = netBaseCents - distributedCents;
  const rowsComplete = rows.length > 0 && rows.every((r, i) => r.description.trim() !== "" && !!r.categoryId && cents[i]! > 0);
  return { distributedCents, remainingCents, rowsComplete, ok: rowsComplete && remainingCents === 0 };
}

export function allocationsPayload(rows: DraftAllocation[]): AllocationPayload[] {
  return rows
    .filter((r) => r.categoryId && (typedToCents(r.amount) ?? 0) > 0)
    .map((r) => ({
      description: r.description.trim() || "Repartição",
      costCenterGroupId: r.groupId,
      costCenterCategoryId: r.categoryId!,
      locationId: r.locationId,
      netCents: typedToCents(r.amount)!,
    }));
}

export function allocationsFromDTO(rows: InvoiceAllocationDTO[]): DraftAllocation[] {
  return rows.map((a) => ({
    key: a.id,
    description: a.description,
    groupId: a.costCenterGroupId,
    categoryId: a.costCenterCategoryId,
    locationId: a.locationId,
    amount: (a.netCents / 100).toFixed(2),
  }));
}

/**
 * Propor repartições a partir das linhas com subcategoria fiável: soma os
 * montantes líquidos (já com descontos) por subcategoria. Linhas sem
 * subcategoria ficam «Por distribuir» — nunca se inventa a correspondência.
 */
export function proposeFromLines(
  lines: { key: string; categoryId: string | null; locationId: string | null; netCents: number }[],
  categories: { id: string; groupId: string; name: string }[],
): DraftAllocation[] {
  const byCat = new Map<string, { net: number; locations: Set<string | null> }>();
  for (const l of lines) {
    if (!l.categoryId || l.netCents <= 0) continue;
    const e = byCat.get(l.categoryId) ?? { net: 0, locations: new Set<string | null>() };
    e.net += l.netCents;
    e.locations.add(l.locationId);
    byCat.set(l.categoryId, e);
  }
  return [...byCat].map(([categoryId, e]) => {
    const cat = categories.find((c) => c.id === categoryId);
    return {
      key: `prop-${categoryId}`,
      description: cat?.name ?? "Repartição",
      groupId: cat?.groupId ?? null,
      categoryId,
      locationId: e.locations.size === 1 ? [...e.locations][0]! : null,
      amount: (e.net / 100).toFixed(2),
    };
  });
}

/** Mistura de subcategorias nas linhas → sugerir «Por valores»/«Por artigo». */
export function hasMixedCategories(lines: { categoryId: string | null }[]): boolean {
  return new Set(lines.map((l) => l.categoryId).filter(Boolean)).size > 1;
}
