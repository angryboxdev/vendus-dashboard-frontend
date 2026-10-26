import type { IngredientCostDTO } from "../entities/recipe-costing.ts";
import type { PreparationItemDTO } from "../entities/technical-sheets.ts";

/**
 * Custo s/ IVA de um lote da preparação: soma de quantidade × custo atual de cada ingrediente
 * (mesma fonte do relatório de custos). Sem ingredientes ou com um sem preço → `complete = false`.
 */
export function preparationBatchCost(items: Pick<PreparationItemDTO, "stock_item_id" | "quantity">[], costs: Map<string, Pick<IngredientCostDTO, "unitCostWithoutVat">>): { cost: number; complete: boolean } {
  let cost = 0;
  let complete = items.length > 0;
  for (const i of items) {
    const unit = costs.get(i.stock_item_id)?.unitCostWithoutVat;
    if (unit == null || unit <= 0) {
      complete = false;
      continue;
    }
    cost += unit * i.quantity;
  }
  return { cost: Math.round(cost * 10000) / 10000, complete };
}
