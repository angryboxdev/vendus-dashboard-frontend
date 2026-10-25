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
  | "cancelled"
  | "excluded";

/** Estados da fila (F3b): Por mapear → Em revisão → Pronto → Movimentado; Excluída e Retirada à parte. */
export const STOCK_PURCHASE_REVIEW_STATUS_LABELS: Record<StockPurchaseReviewStatus, string> = {
  pending: "Por mapear",
  in_review: "Em revisão",
  partial: "Em revisão",
  ready: "Pronto",
  applied: "Movimentado",
  cancelled: "Retirada",
  excluded: "Excluída — não afeta Stock",
};

/** Conciliação proposta para uma linha (F3b) — nunca aplicada sem confirmação. */
export interface LineSuggestionDTO {
  source: "learned" | "name_match" | "ai" | "none";
  resolution: "existing_item" | "no_stock_effect" | null;
  stockItemId: string | null;
  conversionFactor: number | null;
  confidence: number | null;
  packagingChanged: boolean;
}

export const SUGGESTION_SOURCE_LABELS: Record<Exclude<LineSuggestionDTO["source"], "none">, string> = {
  learned: "histórico do fornecedor",
  name_match: "nome igual no catálogo",
  ai: "IA",
};

/** Estados que ainda contam para o badge "Compras por rever (N)" — exclui `applied`/`cancelled`/`excluded`. */
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
  existing_item: "Artigo associado",
  new_item: "Artigo criado",
  no_stock_effect: "Não é item de stock",
};

/** Divisão de uma linha por lojas (F3a) — quantidades na unidade de compra, cuja soma iguala a da linha. */
export interface LocationSplitDTO {
  locationId: string;
  purchaseQuantity: number;
}

export interface CategoryDivergenceDTO {
  lineId: string;
  description: string;
  costCenterCategoryId: string;
  kind: "stock_line_in_non_stock_category" | "non_stock_line_in_stock_category";
}

export const CATEGORY_DIVERGENCE_LABELS: Record<CategoryDivergenceDTO["kind"], string> = {
  stock_line_in_non_stock_category: "associada a um artigo, mas a categoria financeira não é de stock",
  non_stock_line_in_stock_category: "marcada «Não é item de stock», mas a categoria financeira é de stock",
};

/** Conferências da F3a, calculadas pelo backend (valores em cêntimos). */
export interface ReviewConferenceDTO {
  document: {
    /** `unavailable` = revisão anterior à F3a (sem IVA por linha) — não bloqueia. */
    status: "ok" | "mismatch" | "unavailable";
    linesNetCents: number | null;
    linesVatCents: number | null;
    invoiceNetCents: number | null;
    invoiceVatCents: number | null;
    invoiceTotalCents: number | null;
    netDifferenceCents: number | null;
    vatDifferenceCents: number | null;
  };
  stock: {
    inventoriableLines: number;
    nonStockLines: number;
    unresolvedLines: number;
    inventoriableNetCents: number | null;
    nonStockNetCents: number | null;
  };
  categories: { divergences: CategoryDivergenceDTO[] };
}

export interface StockReviewLineDTO {
  id: string;
  invoiceLineId: string;
  description: string;
  purchaseQuantity: number;
  purchaseUnit: string;
  unitCostWithoutVat: number;
  totalWithVat: number;
  /** F3a — null em revisões anteriores (sem IVA da linha guardado). */
  vatAmount: number | null;
  /** Líquido com descontos (total − IVA). */
  netAmount: number | null;
  discountAmount: number | null;
  supplierItemCode: string | null;
  costCenterCategoryId: string | null;
  locationSplits: LocationSplitDTO[] | null;
  suggestion: LineSuggestionDTO | null;
  /** Embalagem de compra ativa e o que esta linha dá (null = «Embalagem por configurar»). */
  packaging?: {
    presentation: PurchasePresentationDTO | null;
    preview: { conversionFactor: number; stockQuantity: number; packages: number | null; netCostPerBaseUnit: number; netCostPerContentUnit: number; netCostPerPackage: number | null } | null;
    baseUnit: string | null;
  };
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
  invoiceNetCents: number | null;
  invoiceVatCents: number | null;
  invoiceTotalCents: number | null;
  /** Registadas ao confirmar — pendência para o Financeiro. */
  categoryDivergences: CategoryDivergenceDTO[] | null;
  /** F3c: importada diretamente no Stock (`stock`) e ainda por lançar no Financeiro. */
  origin?: "finance" | "stock";
  financePending?: boolean;
  conference?: ReviewConferenceDTO;
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
  resolvedLines: number;
  totalCents: number | null;
  locationId: string | null;
  decisionSource: DecisionSource;
  origin?: "finance" | "stock";
  financePending?: boolean;
}

/** Resposta de «Importar fatura» no Stock (F3c). */
export interface StockInvoiceImportResultDTO {
  kind: "created" | "routed";
  invoiceId: string;
  reviewId: string | null;
  validationIssues: string[];
}

export interface ListStockPurchaseReviewsParams {
  /** `active` = por tratar; `history` = movimentadas, excluídas e retiradas. */
  view?: "active" | "history";
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
  /** ≥ 2 lojas, quantidades explícitas que somam a da linha (nunca a quantidade integral em cada loja). */
  locationSplits?: LocationSplitDTO[] | null;
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

// ── Embalagem de compra (task «embalagens e conversões») ───────────────────

export type ContentUnit = "g" | "kg" | "ml" | "cl" | "l" | "un";
export const CONTENT_UNIT_OPTIONS: ContentUnit[] = ["kg", "g", "l", "cl", "ml", "un"];
/** Embalagens habituais (texto livre também é aceite pelo servidor). */
export const PACKAGE_UNIT_OPTIONS = ["saco", "caixa", "lata", "garrafa", "garrafão", "balde", "embalagem", "pacote"];

/** O que a pessoa confirma: vem em embalagem? quanto tem cada uma? a fatura conta embalagens ou peso? */
export interface PresentationForm {
  packageUnit: string | null;
  contentQuantity: number;
  contentUnit: ContentUnit;
  invoicedBy: "package" | "content";
  minOrderPackages: number;
  orderIncrementPackages: number;
}

export interface PurchasePresentationDTO extends PresentationForm {
  id: string;
  supplierId: string;
  supplierReference: string | null;
  description: string;
  stockItemId: string;
  source: "user" | "document" | "catalog";
  confidence: number | null;
  createdBy: string | null;
  createdAt: string;
  supersededAt: string | null;
}

export interface SavePurchasePresentationPayload extends PresentationForm {
  supplierId: string;
  supplierReference: string | null;
  description: string;
  stockItemId: string;
}
