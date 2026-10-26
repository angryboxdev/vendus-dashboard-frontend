/**
 * Lista «Artigos e ingredientes» (task V6): uma entidade (o artigo de stock) e três vistas da mesma
 * tabela — Geral, Reposição e Custos. Custos em cêntimos por unidade base (g, ml, cl, un), s/ IVA.
 */

export type StockItemType = "ingredient" | "beverage" | "packaging" | "cleaning" | "other";

export const STOCK_ITEM_TYPE_LABELS: Record<string, string> = {
  ingredient: "Ingrediente",
  beverage: "Bebida",
  packaging: "Embalagem",
  cleaning: "Higiene e limpeza",
  other: "Outro",
};

/** Artigo como vem do catálogo (`GET /api/stock/items`). */
export interface StockItemDTO {
  id: string;
  name: string;
  sku: string | null;
  category_id: string;
  type: string;
  base_unit: string;
  min_stock: number;
  is_active: boolean;
  /** Soma dos movimentos; ausente/null = artigo sem nenhum movimento. */
  current_quantity?: number | null;
  /** false = artigo sem nenhum movimento (≠ stock 0). */
  has_movements?: boolean;
  /** Custo de referência manual do catálogo (€ por unidade base). */
  purchase_reference_unit_cost_without_vat?: number | null;
}

export interface StockCategoryDTO {
  id: string;
  name: string;
}

/** Resumo de custos de compra confirmados (`GET /api/recipe-costing/ingredients/overview`). */
export interface IngredientCostOverviewDTO {
  stockItemId: string;
  lastPurchase: { invoiceDate: string; supplierId: string | null; supplierName: string; centsPerUnit: number } | null;
  reference: { centsPerUnit: number; from: string; to: string; purchases: number } | null;
  changeRatio: number | null;
  weekly: (number | null)[];
  purchases: number;
}

export interface CostOverviewResponseDTO {
  referenceMethod: string;
  weeks: string[];
  items: IngredientCostOverviewDTO[];
}

/** Embalagem de compra confirmada por fornecedor (`GET /api/stock-purchase-reviews/presentations`). */
export interface PurchasePresentationDTO {
  id: string;
  supplierId: string;
  stockItemId: string;
  packageUnit: string | null;
  contentQuantity: number;
  contentUnit: string;
  invoicedBy: "package" | "content";
  minOrderPackages: number;
  orderIncrementPackages: number;
}

export interface StockMovementDTO {
  id: string;
  type: string;
  quantity: number;
  reason: string | null;
  reference: string | null;
  movement_date: string;
  created_by: string | null;
}

export const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  purchase: "Compra",
  consumption: "Consumo",
  sale: "Venda",
  loss: "Perda",
  adjustment: "Ajuste",
  transfer: "Transferência",
};

/** Compra confirmada de um artigo (linhas do histórico de preços). */
export interface ArticlePurchaseDTO {
  lineId: string;
  reviewId?: string;
  supplierName: string;
  invoiceNumber: string;
  invoiceDate: string;
  quantity: number;
  grossCents: number | null;
  discountCents: number | null;
  netCents: number;
}

export type StockSituation = "out" | "below" | "near" | "ok" | "inactive" | "no_data";

export const SITUATION_LABELS: Record<StockSituation, string> = {
  out: "Sem stock",
  below: "Abaixo do mínimo",
  near: "Próximo do mínimo",
  ok: "OK",
  inactive: "Inativo",
  no_data: "Sem movimentos",
};

export type CatalogView = "general" | "replenishment" | "costs";
