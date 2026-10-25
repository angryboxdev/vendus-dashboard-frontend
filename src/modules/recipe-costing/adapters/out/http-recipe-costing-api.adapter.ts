import { apiGet, apiPut } from "../../../../lib/api.ts";
import type { RecipeCostingReportDTO } from "../../domain/entities/recipe-costing.ts";
import type { RecipeCostingApiPort } from "../../domain/ports/out/recipe-costing-api.port.ts";

export class HttpRecipeCostingApiAdapter implements RecipeCostingApiPort {
  getReport(): Promise<RecipeCostingReportDTO> {
    return apiGet<RecipeCostingReportDTO>("/api/recipe-costing");
  }

  async setManualUnitCost(stockItemId: string, unitCostWithoutVat: number): Promise<void> {
    // Endpoint legado do catálogo de stock (atualização parcial).
    await apiPut(`/api/stock/items/${stockItemId}`, {
      purchase_reference_unit_cost_without_vat: unitCostWithoutVat,
    });
  }
}
