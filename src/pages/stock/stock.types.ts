/** Tipo de item de stock */
export type StockItemType =
  | "ingredient"
  | "beverage"
  | "packaging"
  | "cleaning"
  | "other";

/** Unidade base para quantidade */
export type StockBaseUnit = "g" | "kg" | "ml" | "cl" | "l" | "un";

/** Tipo de movimentação */
export type StockMovementType =
  | "purchase"
  | "consumption"
  | "sale"
  | "loss"
  | "adjustment"
  | "transfer";

export type StockCategory = {
  id: string;
  name: string;
};

export type StockItem = {
  id: string;
  name: string;
  sku: string | null;
  category_id: string;
  type: StockItemType;
  is_sellable: boolean;
  sale_price: number | null;
  min_stock: number;
  base_unit: StockBaseUnit;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
  /** Calculado: SUM(stock_movements.quantity) */
  current_quantity?: number;
  /** Calculado: média ponderada das compras (opcional) */
  average_cost_per_base_unit?: number | null;
};

export type StockMovement = {
  id: string;
  item_id: string;
  type: StockMovementType;
  quantity: number;
  unit_cost_per_base_unit: number | null;
  reason: string | null;
  reference: string | null;
  movement_date: string; // ISO 8601 – data em que a movimentação ocorreu
  created_at: string;
  created_by: string | null;
};

export type StockCategoryCreateBody = { name: string };
export type StockCategoryUpdateBody = { name: string };

export type StockItemCreateBody = {
  name: string;
  sku?: string | null;
  category_id: string;
  type: StockItemType;
  is_sellable?: boolean;
  sale_price?: number | null;
  min_stock?: number;
  base_unit: StockBaseUnit;
  is_active?: boolean;
};

export type StockItemUpdateBody = Partial<
  Omit<StockItemCreateBody, "category_id">
> & {
  category_id?: string;
  name?: string;
  sku?: string | null;
  type?: StockItemType;
  is_sellable?: boolean;
  sale_price?: number | null;
  min_stock?: number;
  base_unit?: StockBaseUnit;
  is_active?: boolean;
};

export type StockMovementCreateBody = {
  item_id: string;
  type: StockMovementType;
  quantity: number;
  unit_cost_per_base_unit?: number | null;
  reason?: string | null;
  reference?: string | null;
  movement_date?: string; // ISO 8601 – se omitido, backend usa "agora"
  created_by?: string | null;
};

export type StockMovementUpdateBody = {
  movement_date?: string;
  quantity?: number;
  unit_cost_per_base_unit?: number | null;
  reason?: string | null;
  reference?: string | null;
};

export const STOCK_ITEM_TYPE_LABELS: Record<StockItemType, string> = {
  ingredient: "Ingrediente",
  beverage: "Bebida",
  packaging: "Embalagem",
  cleaning: "Limpeza",
  other: "Outro",
};

export const STOCK_BASE_UNIT_LABELS: Record<StockBaseUnit, string> = {
  g: "g",
  kg: "kg",
  ml: "ml",
  cl: "cl",
  l: "l",
  un: "un",
};

export const STOCK_MOVEMENT_TYPE_LABELS: Record<StockMovementType, string> = {
  purchase: "Compra",
  consumption: "Consumo",
  sale: "Venda",
  loss: "Perda",
  adjustment: "Ajuste",
  transfer: "Transferência",
};
