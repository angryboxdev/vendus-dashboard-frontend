import type {
  StockPurchaseReviewDTO,
  StockPurchaseReviewRowDTO,
  ListStockPurchaseReviewsParams,
  ResolveStockReviewLinePayload,
  DecideUnresolvedPayload,
  ConfirmStockPurchaseReviewPayload,
  CancelStockPurchaseReviewPayload,
  StockItemOptionDTO,
  StockCategoryOptionDTO,
  StockInvoiceImportResultDTO,
  PurchasePresentationDTO,
  SavePurchasePresentationPayload,
  EntryRules,
  StockSettings,
} from "../../entities/stock-purchase-review.ts";

export interface StockPurchaseReviewApiPort {
  listReviews(params?: ListStockPurchaseReviewsParams): Promise<StockPurchaseReviewRowDTO[]>;
  getReview(id: string): Promise<StockPurchaseReviewDTO>;
  /** Pode rejeitar com `ApiError` 409 `{ error, currentVersion }` — a UI deve recarregar a revisão e avisar o utilizador. */
  resolveLine(reviewId: string, lineId: string, payload: ResolveStockReviewLinePayload): Promise<StockPurchaseReviewDTO>;
  /** Conciliação das linhas por resolver (histórico → nome → IA); grava as sugestões, nunca resolve. */
  suggestMappings(reviewId: string, options?: { refresh?: boolean }): Promise<StockPurchaseReviewDTO>;
  decideUnresolved(reviewId: string, payload: DecideUnresolvedPayload): Promise<StockPurchaseReviewDTO>;
  /** Só válido com `status === "ready"`. Pode rejeitar com 400 pedindo `locationId` — repetir a chamada com o campo preenchido. */
  confirmReview(reviewId: string, payload: ConfirmStockPurchaseReviewPayload): Promise<StockPurchaseReviewDTO>;
  cancelReview(reviewId: string, payload: CancelStockPurchaseReviewPayload): Promise<StockPurchaseReviewDTO>;
  /**
   * F3c: importar a fatura diretamente no Stock (mesmo leitor do Financeiro). 409 com `code`:
   * `already_in_stock` (bloqueia), `already_in_review`, `draft_in_finance`, `exists_not_routed`; 422 `extraction_failed`.
   */
  importInvoiceForStock(file: File, options?: { routeExisting?: boolean }): Promise<StockInvoiceImportResultDTO>;
  /** Localização principal do Stock (entradas de faturas sem perguntar a loja). */
  getStockSettings(): Promise<StockSettings>;
  saveStockSettings(defaultLocationId: string | null): Promise<StockSettings>;
  /** Regras de entrada no Stock da empresa (efetivas, com as predefinições). */
  getEntryRules(): Promise<EntryRules>;
  saveEntryRules(rules: EntryRules): Promise<EntryRules>;
  /** Embalagens de compra ativas de um fornecedor. */
  listPresentations(supplierId: string): Promise<PurchasePresentationDTO[]>;
  /** Confirma/altera a embalagem (cria versão nova; 400 se as unidades não se convertem). */
  savePresentation(payload: SavePurchasePresentationPayload): Promise<PurchasePresentationDTO>;
  /** «Repor em Compras por rever» — só para revisões retiradas. */
  restoreReview(reviewId: string, payload: { expectedVersion: number }): Promise<StockPurchaseReviewDTO>;

  /** Reaproveita `/api/stock/items` (módulo legado de stock) para o picker de "item existente". */
  listStockItemOptions(): Promise<StockItemOptionDTO[]>;
  /** Reaproveita `/api/stock/categories` para o formulário de "novo item". */
  listStockCategoryOptions(): Promise<StockCategoryOptionDTO[]>;
}
