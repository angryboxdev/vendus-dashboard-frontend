import type { DishesImpactDTO, IngredientPriceHistoryDTO, MenuCostingSettingsDTO, RecipeCostingReportDTO, WeeklyDishCostDTO } from "../../entities/recipe-costing.ts";

export interface RecipeCostingApiPort {
  getReport(): Promise<RecipeCostingReportDTO>;
  /** Histórico semanal do preço de compra de um ingrediente (últimas `weeks` semanas). */
  getPriceHistory(stockItemId: string, weeks?: number): Promise<IngredientPriceHistoryDTO>;
  /** Custo teórico semanal de uma pizza por tamanho (últimas `weeks` semanas). */
  getDishWeeklyCost(pizzaId: string, weeks?: number): Promise<WeeklyDishCostDTO>;
  /** Custo atual de cada pizza face a há `compareWeeks` semanas, com o ingrediente que mais pesou. */
  getDishesImpact(compareWeeks?: number): Promise<DishesImpactDTO>;
  /** Taxa de IVA das vendas usada na margem dos pratos (V7). */
  getSettings(): Promise<MenuCostingSettingsDTO>;
  saveSettings(salesVatRate: number): Promise<MenuCostingSettingsDTO>;
  /**
   * Custo manual s/ IVA por unidade base no catálogo do artigo. Só vale enquanto
   * não houver compra importada: a fatura seguinte passa à frente.
   */
  setManualUnitCost(stockItemId: string, unitCostWithoutVat: number): Promise<void>;
}
