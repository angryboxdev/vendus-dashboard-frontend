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
  /** «Repor em Compras por rever» — só para revisões retiradas. */
  restoreReview(reviewId: string, payload: { expectedVersion: number }): Promise<StockPurchaseReviewDTO>;

  /** Reaproveita `/api/stock/items` (módulo legado de stock) para o picker de "item existente". */
  listStockItemOptions(): Promise<StockItemOptionDTO[]>;
  /** Reaproveita `/api/stock/categories` para o formulário de "novo item". */
  listStockCategoryOptions(): Promise<StockCategoryOptionDTO[]>;
}
