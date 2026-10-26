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

/** Margem teórica s/ IVA (V7): PVP sem IVA − custo. Só com custo completo e PVP. */
export interface MenuCostingSettingsDTO {
  salesVatRate: number;
  isDefault: boolean;
}

export interface DishMarginDTO {
  netSalePrice: number;
  marginWithoutVat: number;
  /** 0,7 = 70% do PVP sem IVA. */
  marginRatio: number;
  /** CMV teórico: custo ÷ PVP sem IVA. */
  foodCostRatio: number;
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
  /** `null` sem PVP ou com custo parcial. Ausente em respostas antigas. */
  margin?: DishMarginDTO | null;
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
  /** Taxa de IVA das vendas (%) usada na margem. */
  salesVatRate?: number;
  dishes: DishCostingDTO[];
  ingredients: IngredientCostDTO[];
  missingPrices: MissingPriceIngredientDTO[];
  /** Custo de um lote de cada preparação (V7). Ausente em respostas antigas. */
  preparations?: PreparationCostDTO[];
}

export interface PreparationCostDTO {
  preparationId: string;
  name: string;
  yieldQty: number;
  useAsUnit: boolean;
  itemCount: number;
  batchCostWithoutVat: number;
  complete: boolean;
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

// ── Impacto do preço dos ingredientes nas pizzas (task V6 §8) — `GET /api/recipe-costing/dishes/impact` ──

export interface ImpactLineDTO {
  name: string;
  stockItemId: string | null;
  preparationId: string | null;
  quantity: number;
  baseUnit: string | null;
  nowCost: number;
  thenCost: number;
  /** nowCost − thenCost, € s/ IVA (a soma das linhas dá a variação total). */
  diff: number;
  nowSource: WeeklyPriceSource;
  thenSource: WeeklyPriceSource;
  complete: boolean;
}

export interface DishSizeImpactDTO {
  size: string;
  now: { week: string; costWithoutVat: number; complete: boolean };
  then: { week: string; costWithoutVat: number; complete: boolean };
  /** Só com as duas semanas completas (todos os ingredientes com preço). */
  comparable: boolean;
  change: number | null;
  changeRatio: number | null;
  mainFactor: { name: string; diff: number } | null;
  lines: ImpactLineDTO[];
}

export interface DishesImpactDTO {
  method: string;
  now: { week: string; weekStart: string };
  then: { week: string; weekStart: string };
  dishes: { pizzaId: string; name: string; category: string; isActive: boolean; versionFrom: string; sizes: DishSizeImpactDTO[] }[];
}
