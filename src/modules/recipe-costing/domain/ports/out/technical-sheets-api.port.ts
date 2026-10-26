import type {
  ComponentRef,
  DishCategory,
  DishDTO,
  DishPriceDTO,
  PreparationDTO,
  PreparationItemDTO,
  RecipeDTO,
  RecipeItemDTO,
  StockItemOptionDTO,
  Variant,
} from "../../entities/technical-sheets.ts";

/** Pratos, receitas, PVP e preparações — endpoints existentes (`/api/pizzas`, `/api/preparations`). */
export interface TechnicalSheetsApiPort {
  listDishes(): Promise<DishDTO[]>;
  createDish(body: { name: string; category: DishCategory; description?: string }): Promise<DishDTO>;
  updateDish(id: string, body: Partial<Pick<DishDTO, "name" | "category" | "description" | "is_active">>): Promise<DishDTO>;

  listPrices(dishId: string): Promise<DishPriceDTO[]>;
  /** PVP com IVA de uma variante: cria, altera ou (null) remove. */
  savePrice(dishId: string, size: Variant, price: number | null, existing: DishPriceDTO | null): Promise<void>;

  /** Receita ativa do prato e as suas linhas; `null` = o prato ainda não tem ficha. */
  getActiveRecipe(dishId: string): Promise<{ recipe: RecipeDTO; items: RecipeItemDTO[] } | null>;
  createRecipe(dishId: string): Promise<RecipeDTO>;
  addRecipeItem(dishId: string, recipeId: string, ref: ComponentRef, size: Variant, quantity: number): Promise<RecipeItemDTO>;
  updateRecipeItem(dishId: string, recipeId: string, itemId: string, quantity: number): Promise<RecipeItemDTO>;
  deleteRecipeItem(dishId: string, recipeId: string, itemId: string): Promise<void>;

  listPreparations(): Promise<PreparationDTO[]>;
  getPreparation(id: string): Promise<PreparationDTO & { items: PreparationItemDTO[] }>;
  createPreparation(body: { name: string; description?: string; yield_qty: number; yield_unit: string; use_as_unit: boolean }): Promise<PreparationDTO>;
  updatePreparation(id: string, body: Partial<Pick<PreparationDTO, "name" | "description" | "yield_qty" | "yield_unit" | "use_as_unit" | "is_active">>): Promise<PreparationDTO>;
  addPreparationItem(id: string, stockItemId: string, quantity: number): Promise<PreparationItemDTO>;
  updatePreparationItem(id: string, itemId: string, quantity: number): Promise<PreparationItemDTO>;
  deletePreparationItem(id: string, itemId: string): Promise<void>;

  listStockItems(): Promise<StockItemOptionDTO[]>;
}
