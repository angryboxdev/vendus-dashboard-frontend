import { apiGet, apiPut } from "../../../../lib/api.ts";
import type { IngredientPriceHistoryDTO, RecipeCostingReportDTO, WeeklyDishCostDTO } from "../../domain/entities/recipe-costing.ts";
import type { RecipeCostingApiPort } from "../../domain/ports/out/recipe-costing-api.port.ts";

export class HttpRecipeCostingApiAdapter implements RecipeCostingApiPort {
  getReport(): Promise<RecipeCostingReportDTO> {
    return apiGet<RecipeCostingReportDTO>("/api/recipe-costing");
  }

  getPriceHistory(stockItemId: string, weeks = 26): Promise<IngredientPriceHistoryDTO> {
    return apiGet<IngredientPriceHistoryDTO>(`/api/recipe-costing/ingredients/${stockItemId}/price-history?weeks=${weeks}`);
  }

  getDishWeeklyCost(pizzaId: string, weeks = 12): Promise<WeeklyDishCostDTO> {
    return apiGet<WeeklyDishCostDTO>(`/api/recipe-costing/dishes/${pizzaId}/weekly?weeks=${weeks}`);
  }

  async setManualUnitCost(stockItemId: string, unitCostWithoutVat: number): Promise<void> {
    // Endpoint legado do catálogo de stock (atualização parcial).
    await apiPut(`/api/stock/items/${stockItemId}`, {
      purchase_reference_unit_cost_without_vat: unitCostWithoutVat,
    });
  }
}
