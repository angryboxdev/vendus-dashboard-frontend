import { apiDelete, apiGet, apiPost, apiPut } from "../../../../lib/api.ts";
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
} from "../../domain/entities/technical-sheets.ts";
import type { TechnicalSheetsApiPort } from "../../domain/ports/out/technical-sheets-api.port.ts";

/** Endpoints legados de pizzas e preparos (a interface chama-lhes pratos e preparações). */
export class HttpTechnicalSheetsApiAdapter implements TechnicalSheetsApiPort {
  listDishes(): Promise<DishDTO[]> {
    return apiGet<DishDTO[]>("/api/pizzas");
  }

  createDish(body: { name: string; category: DishCategory; description?: string }): Promise<DishDTO> {
    return apiPost<DishDTO>("/api/pizzas", { ...body, is_active: true });
  }

  updateDish(id: string, body: Partial<Pick<DishDTO, "name" | "category" | "description" | "is_active">>): Promise<DishDTO> {
    return apiPut<DishDTO>(`/api/pizzas/${id}`, body);
  }

  listPrices(dishId: string): Promise<DishPriceDTO[]> {
    return apiGet<DishPriceDTO[]>(`/api/pizzas/${dishId}/prices`);
  }

  async savePrice(dishId: string, size: Variant, price: number | null, existing: DishPriceDTO | null): Promise<void> {
    if (price == null) {
      if (existing) await apiDelete(`/api/pizzas/${dishId}/prices/${existing.id}`);
      return;
    }
    if (existing) await apiPut(`/api/pizzas/${dishId}/prices/${existing.id}`, { price });
    else await apiPost(`/api/pizzas/${dishId}/prices`, { size, price });
  }

  async getActiveRecipe(dishId: string): Promise<{ recipe: RecipeDTO; items: RecipeItemDTO[] } | null> {
    const recipes = await apiGet<RecipeDTO[]>(`/api/pizzas/${dishId}/recipes`);
    const recipe = recipes.find((r) => r.is_active);
    if (!recipe) return null;
    const items = await apiGet<RecipeItemDTO[]>(`/api/pizzas/${dishId}/recipes/${recipe.id}/items`);
    return { recipe, items };
  }

  createRecipe(dishId: string): Promise<RecipeDTO> {
    return apiPost<RecipeDTO>(`/api/pizzas/${dishId}/recipes`, {});
  }

  addRecipeItem(dishId: string, recipeId: string, ref: ComponentRef, size: Variant, quantity: number): Promise<RecipeItemDTO> {
    return apiPost<RecipeItemDTO>(`/api/pizzas/${dishId}/recipes/${recipeId}/items`, { ...ref, size, quantity });
  }

  updateRecipeItem(dishId: string, recipeId: string, itemId: string, quantity: number): Promise<RecipeItemDTO> {
    return apiPut<RecipeItemDTO>(`/api/pizzas/${dishId}/recipes/${recipeId}/items/${itemId}`, { quantity });
  }

  async deleteRecipeItem(dishId: string, recipeId: string, itemId: string): Promise<void> {
    await apiDelete(`/api/pizzas/${dishId}/recipes/${recipeId}/items/${itemId}`);
  }

  listPreparations(): Promise<PreparationDTO[]> {
    return apiGet<PreparationDTO[]>("/api/preparations");
  }

  getPreparation(id: string): Promise<PreparationDTO & { items: PreparationItemDTO[] }> {
    return apiGet<PreparationDTO & { items: PreparationItemDTO[] }>(`/api/preparations/${id}`);
  }

  createPreparation(body: { name: string; description?: string; yield_qty: number; yield_unit: string; use_as_unit: boolean }): Promise<PreparationDTO> {
    return apiPost<PreparationDTO>("/api/preparations", body);
  }

  updatePreparation(id: string, body: Partial<Pick<PreparationDTO, "name" | "description" | "yield_qty" | "yield_unit" | "use_as_unit" | "is_active">>): Promise<PreparationDTO> {
    return apiPut<PreparationDTO>(`/api/preparations/${id}`, body);
  }

  addPreparationItem(id: string, stockItemId: string, quantity: number): Promise<PreparationItemDTO> {
    return apiPost<PreparationItemDTO>(`/api/preparations/${id}/items`, { stock_item_id: stockItemId, quantity });
  }

  updatePreparationItem(id: string, itemId: string, quantity: number): Promise<PreparationItemDTO> {
    return apiPut<PreparationItemDTO>(`/api/preparations/${id}/items/${itemId}`, { quantity });
  }

  async deletePreparationItem(id: string, itemId: string): Promise<void> {
    await apiDelete(`/api/preparations/${id}/items/${itemId}`);
  }

  listStockItems(): Promise<StockItemOptionDTO[]> {
    return apiGet<StockItemOptionDTO[]>("/api/stock/items");
  }
}
