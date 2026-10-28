import type { FoodCost, ProductMappingChange } from "../../entities/food-cost.ts";

/** Custo real da comida e da embalagem do delivery num mês. */
export interface GetFoodCostPort {
  execute(year: number, month: number): Promise<FoodCost>;
}

/** Grava as correções dos produtos e da embalagem. */
export interface SaveProductMappingsPort {
  execute(changes: ProductMappingChange[]): Promise<void>;
}
