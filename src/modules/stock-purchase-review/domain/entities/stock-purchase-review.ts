/**
 * "Compra por rever" — quando uma fatura (módulo Faturas) é finalizada, o
 * backend decide (via categoria/fornecedor, nunca Centro de Custo) se deve
 * gerar uma revisão de impacto em stock. Um humano mapeia cada linha da
 * fatura para um item de stock existente (com fator de conversão), um item
 * novo (criado a quantidade 0), ou "não afeta stock" — só ao confirmar
 * explicitamente é que o stock real se move.
 *
 * Fase 1 (minimal): lista simples + formulário simples, sem wizard.
 */

export type StockPurchaseReviewStatus =
  | "pending"
  | "in_review"
  | "partial"
  | "ready"
  | "applied"
  | "cancelled";

export const STOCK_PURCHASE_REVIEW_STATUS_LABELS: Record<StockPurchaseReviewStatus, string> = {
  pending: "Pendente",
  in_review: "Em revisão",
  partial: "Parcial",
  ready: "Pronta",
  applied: "Aplicada",
  cancelled: "Cancelada",
};

/** Estados que ainda contam para o badge "Compras por rever (N)" — exclui `applied`/`cancelled`. */
export const OPEN_STOCK_PURCHASE_REVIEW_STATUSES: StockPurchaseReviewStatus[] = [
  "pending",
  "in_review",
  "partial",
  "ready",
];

export type DecisionSource = "override" | "category" | "supplier" | "unresolved";

export const DECISION_SOURCE_LABELS: Record<DecisionSource, string> = {
  override: "Override manual",
  category: "Categoria",
  supplier: "Fornecedor",
  unresolved: "Sem decisão automática",
};

export type ResolutionType = "unresolved" | "existing_item" | "new_item" | "no_stock_effect";

export const RESOLUTION_TYPE_LABELS: Record<ResolutionType, string> = {
  unresolved: "Por resolver",
  existing_item: "Item existente",
  new_item: "Novo item",
  no_stock_effect: "Não afeta stock",
};

export interface StockReviewLineDTO {
  id: string;
  invoiceLineId: string;
  description: string;
  purchaseQuantity: number;
  purchaseUnit: string;
  unitCostWithoutVat: number;
  totalWithVat: number;
  resolutionType: ResolutionType;
  stockItemId: string | null;
  conversionFactor: number | null;
  /** = purchaseQuantity × conversionFactor, calculado no backend. */
  stockQuantity: number | null;
  locationId: string | null;
  unitCostPerBaseUnitWithVat: number | null;
  unitCostPerBaseUnitWithoutVat: number | null;
  /** Ex.: kg→L — nunca bloqueia, é só um aviso visual. */
  flaggedSuspiciousConversion: boolean;
  flagReason: string | null;
  resolvedBy: string | null;
  resolvedAt: string | null;
}

export interface StockPurchaseReviewDTO {
  id: string;
  invoiceId: string;
  status: StockPurchaseReviewStatus;
  /** Optimistic-lock — obrigatório fazer round-trip em qualquer chamada de escrita. */
  version: number;
  decisionSource: DecisionSource;
  decisionCategoryId: string | null;
  decisionSupplierId: string | null;
  decisionPolicyUsed: string;
  decisionActor: string | null;
  decisionOverrideReason: string | null;
  decisionAt: string;
  supplierName: string;
  invoiceNumber: string;
  invoiceDate: string;
  locationId: string | null;
  appliedAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  lines: StockReviewLineDTO[];
  createdAt: string;
  updatedAt: string;
}

export interface StockPurchaseReviewRowDTO {
  id: string;
  invoiceId: string;
  supplierName: string;
  invoiceNumber: string;
  invoiceDate: string;
  status: StockPurchaseReviewStatus;
  linesCount: number;
}

export interface ListStockPurchaseReviewsParams {
  status?: StockPurchaseReviewStatus;
  supplierId?: string;
  from?: string;
  to?: string;
  search?: string;
}

export interface NewStockItemPayload {
  name: string;
  categoryId: string;
  /** Tipo de item de stock (ex.: "ingredient") — string livre para acompanhar o backend. */
  type: string;
  /** Unidade base do item novo, ex.: "g"/"kg"/"ml"/"l"/"un"/"cl". */
  baseUnit: string;
}

export interface ResolveStockReviewLinePayload {
  expectedVersion: number;
  resolution: "existing_item" | "new_item" | "no_stock_effect";
  /** Obrigatório para "existing_item". */
  stockItemId?: string | null;
  /** Obrigatório para "new_item". */
  newItem?: NewStockItemPayload;
  /** Obrigatório para "existing_item"/"new_item" — purchaseQuantity × isto = stockQuantity. */
  conversionFactor?: number;
  locationId?: string | null;
}

export interface StockReviewLineSuggestionDTO {
  resolutionType: "existing_item" | "no_stock_effect";
  stockItemId: string | null;
  conversionFactor: number | null;
  purchaseUnit: string | null;
  isItemActive: boolean;
}

export interface DecideUnresolvedPayload {
  expectedVersion: number;
  outcome: "create" | "skip";
}

export interface ConfirmStockPurchaseReviewPayload {
  expectedVersion: number;
  effectiveDate?: string;
  locationId?: string | null;
}

export interface CancelStockPurchaseReviewPayload {
  expectedVersion: number;
  reason: string;
}

/** Corpo `{ error, currentVersion }` do 409 de conflito optimistic-lock. */
export interface StockReviewVersionConflictData {
  error: string;
  currentVersion: number;
}

/** Corpo do 400 quando o backend precisa que a UI escolha uma loja antes de confirmar. */
export interface LocationRequiredErrorData {
  error: string;
}

// ── Pickers (reaproveitam os endpoints já existentes do módulo de stock) ────

export interface StockItemOptionDTO {
  id: string;
  name: string;
  baseUnit: string;
  categoryId: string;
  isActive: boolean;
}

export interface StockCategoryOptionDTO {
  id: string;
  name: string;
}
