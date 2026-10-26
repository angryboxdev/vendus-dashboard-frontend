import type { IngredientPriceHistoryDTO, RecipeCostingReportDTO, WeeklyDishCostDTO } from "../../entities/recipe-costing.ts";

export interface RecipeCostingApiPort {
  getReport(): Promise<RecipeCostingReportDTO>;
  /** Histórico semanal do preço de compra de um ingrediente (últimas `weeks` semanas). */
  getPriceHistory(stockItemId: string, weeks?: number): Promise<IngredientPriceHistoryDTO>;
  /** Custo teórico semanal de uma pizza por tamanho (últimas `weeks` semanas). */
  getDishWeeklyCost(pizzaId: string, weeks?: number): Promise<WeeklyDishCostDTO>;
  /**
   * Custo manual s/ IVA por unidade base no catálogo do artigo. Só vale enquanto
   * não houver compra importada: a fatura seguinte passa à frente.
   */
  setManualUnitCost(stockItemId: string, unitCostWithoutVat: number): Promise<void>;
}
