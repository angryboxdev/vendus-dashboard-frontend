/** Contrato de `GET /api/recipe-costing` (backend `recipe-costing`). Custos s/ IVA, por unidade base. */
export type CostSource = "invoice" | "manual";

export interface IngredientCostDTO {
  stockItemId: string;
  name: string;
  baseUnit: string;
  unitCostWithoutVat: number | null;
  source: CostSource | null;
}

/** Custo de uma linha da ficha técnica (artigo direto ou preparo), com a perda aplicada. */
export interface DishLineCostDTO {
  stockItemId: string | null;
  preparationId: string | null;
  name: string;
  quantity: number;
  /** Unidade base do artigo; `null` num preparo. */
  baseUnit: string | null;
  wasteFactor: number | null;
  unitCostWithoutVat: number | null;
  /** Parcial quando `complete = false` (falta o preço de algum ingrediente). */
  costWithoutVat: number;
  complete: boolean;
}

export interface DishSizeCostDTO {
  size: string;
  costWithoutVat: number;
  salePrice: number | null;
  /** `false` = falta o preço de algum ingrediente; o custo está subavaliado. */
  complete: boolean;
  missingStockItemIds: string[];
  /** Custo de cada linha da ficha, pela ordem da receita. */
  lines: DishLineCostDTO[];
}

export interface DishCostingDTO {
  pizzaId: string;
  name: string;
  category: string;
  isActive: boolean;
  hasActiveRecipe: boolean;
  sizes: DishSizeCostDTO[];
}

export interface MissingPriceIngredientDTO {
  stockItemId: string;
  name: string;
  baseUnit: string;
  usedIn: { pizzaId: string; name: string }[];
}

export interface RecipeCostingReportDTO {
  dishes: DishCostingDTO[];
  ingredients: IngredientCostDTO[];
  missingPrices: MissingPriceIngredientDTO[];
}
