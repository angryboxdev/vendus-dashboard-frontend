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

// ── Histórico semanal do preço de compra (task V5 §5) — `GET /api/recipe-costing/ingredients/:id/price-history` ──

export interface PurchaseObservationDTO {
  lineId: string;
  supplierName: string;
  invoiceNumber: string;
  invoiceDate: string;
  /** Na unidade base do artigo. */
  quantity: number;
  grossCents: number | null;
  discountCents: number | null;
  /** Custo líquido s/ IVA da linha, depois do desconto (cêntimos). */
  netCents: number;
}

export interface WeeklyPricePointDTO {
  week: string;
  weekStart: string;
  quantity: number;
  netCents: number;
  /** Média ponderada, cêntimos por unidade base; null = sem nova compra. */
  avgCentsPerUnit: number | null;
  /** Último preço anterior (referência transportada, não pago nesta semana). */
  carriedCentsPerUnit: number | null;
  carriedFromWeek: string | null;
  changeRatio: number | null;
  partial: boolean;
  observations: PurchaseObservationDTO[];
}

export interface IngredientPriceHistoryDTO {
  stockItemId: string;
  name: string;
  baseUnit: string;
  weeks: WeeklyPricePointDTO[];
  lastPurchase: { invoiceDate: string; supplierName: string; centsPerUnit: number } | null;
}

// ── Custo teórico semanal da pizza (task V5 §6) — `GET /api/recipe-costing/dishes/:id/weekly` ──

export type WeeklyPriceSource = "purchase" | "carried" | "manual" | "none";

export interface WeeklyLineCostDTO {
  stockItemId: string | null;
  preparationId: string | null;
  name: string;
  quantity: number;
  baseUnit: string | null;
  costWithoutVat: number;
  source: WeeklyPriceSource;
  complete: boolean;
}

export interface WeeklyDishCostPointDTO {
  week: string;
  weekStart: string;
  partial: boolean;
  status: "ok" | "incomplete" | "no_version";
  versionFrom: string | null;
  costWithoutVat: number | null;
  changeRatio: number | null;
  lines: WeeklyLineCostDTO[];
}

export interface WeeklyDishCostDTO {
  pizzaId: string;
  name: string;
  firstVersionAt: string | null;
  sizes: { size: string; weeks: WeeklyDishCostPointDTO[] }[];
}
