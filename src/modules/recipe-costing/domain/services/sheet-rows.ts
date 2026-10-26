import type { DishCostingDTO, DishSizeCostDTO, RecipeCostingReportDTO } from "../entities/recipe-costing.ts";
import type { DishDTO } from "../entities/technical-sheets.ts";

export type CostState = "complete" | "partial" | "no_recipe";

export interface DishRow {
  dish: DishDTO;
  costing: DishCostingDTO | null;
  /** Variantes com custo calculado, pela ordem do relatório (XS → Pequena → Grande). */
  sizes: DishSizeCostDTO[];
  state: CostState;
  /** Ingredientes distintos sem custo conhecido usados no prato. */
  missingCount: number;
  /** Menor e maior margem s/ IVA entre as variantes com margem; `null` sem nenhuma. */
  marginRange: { min: number; max: number; minRatio: number; maxRatio: number } | null;
}

/** Junta a lista de pratos ao relatório de custos: estado, ingredientes por resolver e margem. */
export function buildDishRows(dishes: DishDTO[], report: RecipeCostingReportDTO | null): DishRow[] {
  const byId = new Map((report?.dishes ?? []).map((d) => [d.pizzaId, d]));
  return dishes.map((dish) => {
    const costing = byId.get(dish.id) ?? null;
    const sizes = costing?.sizes ?? [];
    const hasLines = sizes.some((s) => s.lines.length > 0);
    const missing = new Set(sizes.flatMap((s) => s.missingStockItemIds));
    const state: CostState = !costing?.hasActiveRecipe || !hasLines ? "no_recipe" : sizes.every((s) => s.complete || s.lines.length === 0) ? "complete" : "partial";
    // Margem só de variantes com composição (um prato sem ficha nunca mostra margem).
    const margins = sizes.filter((s) => s.lines.length > 0).map((s) => s.margin).filter((m): m is NonNullable<typeof m> => m != null);
    const marginRange = margins.length
      ? {
          min: Math.min(...margins.map((m) => m.marginWithoutVat)),
          max: Math.max(...margins.map((m) => m.marginWithoutVat)),
          minRatio: Math.min(...margins.map((m) => m.marginRatio)),
          maxRatio: Math.max(...margins.map((m) => m.marginRatio)),
        }
      : null;
    return { dish, costing, sizes, state, missingCount: missing.size, marginRange };
  });
}

/** Ingredientes sem custo conhecido usados em pratos ativos, e quantos pratos ativos ficam parciais. */
export function missingSummary(report: RecipeCostingReportDTO | null, activeDishIds: Set<string>): { ingredients: number; dishes: number } {
  if (!report) return { ingredients: 0, dishes: 0 };
  const ingredients = report.missingPrices.filter((m) => m.usedIn.some((u) => activeDishIds.has(u.pizzaId))).length;
  const dishes = report.dishes.filter((d) => activeDishIds.has(d.pizzaId) && d.sizes.some((s) => !s.complete && s.lines.length > 0)).length;
  return { ingredients, dishes };
}
