import type { RecipeCostingReportDTO } from "../../entities/recipe-costing.ts";

export interface RecipeCostingApiPort {
  getReport(): Promise<RecipeCostingReportDTO>;
  /**
   * Custo manual s/ IVA por unidade base no catálogo do artigo. Só vale enquanto
   * não houver compra importada: a fatura seguinte passa à frente.
   */
  setManualUnitCost(stockItemId: string, unitCostWithoutVat: number): Promise<void>;
}
