import type { IngredientPriceHistoryDTO } from "../entities/recipe-costing.ts";
import { pricingUnit } from "./pricing-unit.ts";

export type PricePointKind = "purchase" | "carried" | "none";

export interface PriceChartPoint {
  week: string;
  /** Preço na unidade de preço (€/kg, €/l, €/un); null sem preço conhecido. */
  value: number | null;
  /** «purchase» = compra real nesta semana; «carried» = último preço anterior (referência). */
  kind: PricePointKind;
  partial: boolean;
}

/** Série semanal em €/kg (ou €/l, €/un) a partir dos cêntimos por unidade base. */
export function priceChartPoints(history: IngredientPriceHistoryDTO): { unit: string; points: PriceChartPoint[] } {
  const { label, factor } = pricingUnit(history.baseUnit);
  const toEur = (cents: number) => (cents * factor) / 100;
  return {
    unit: label,
    points: history.weeks.map((w) => ({
      week: w.week,
      value: w.avgCentsPerUnit != null ? toEur(w.avgCentsPerUnit) : w.carriedCentsPerUnit != null ? toEur(w.carriedCentsPerUnit) : null,
      kind: w.avgCentsPerUnit != null ? "purchase" : w.carriedCentsPerUnit != null ? "carried" : "none",
      partial: w.partial,
    })),
  };
}

/** Preço de uma linha de compra em €/kg (ou €/l, €/un). */
export function observationPrice(netCents: number, quantity: number, baseUnit: string): number | null {
  if (!(quantity > 0)) return null;
  return ((netCents / quantity) * pricingUnit(baseUnit).factor) / 100;
}
