import { apiGet, apiPost } from "../../../../lib/api.ts";
import type { StockPurchaseReviewApiPort } from "../../domain/ports/out/stock-purchase-review-api.port.ts";
import type {
  StockPurchaseReviewDTO,
  StockPurchaseReviewRowDTO,
  ListStockPurchaseReviewsParams,
  ResolveStockReviewLinePayload,
  StockReviewLineSuggestionDTO,
  DecideUnresolvedPayload,
  ConfirmStockPurchaseReviewPayload,
  CancelStockPurchaseReviewPayload,
  StockItemOptionDTO,
  StockCategoryOptionDTO,
} from "../../domain/entities/stock-purchase-review.ts";

const BASE = "/api/stock-purchase-reviews";

/** Forma devolvida por `/api/stock/items` (módulo legado, snake_case). */
interface LegacyStockItem {
  id: string;
  name: string;
  base_unit: string;
  category_id: string;
  is_active: boolean;
}

/** Forma devolvida por `/api/stock/categories` (módulo legado). */
interface LegacyStockCategory {
  id: string;
  name: string;
}

export class HttpStockPurchaseReviewApiAdapter implements StockPurchaseReviewApiPort {
  async listReviews(params?: ListStockPurchaseReviewsParams): Promise<StockPurchaseReviewRowDTO[]> {
    const q = new URLSearchParams();
    if (params?.status) q.set("status", params.status);
    if (params?.supplierId) q.set("supplierId", params.supplierId);
    if (params?.from) q.set("from", params.from);
    if (params?.to) q.set("to", params.to);
    if (params?.search) q.set("search", params.search);
    const qs = q.toString();
    return apiGet(`${BASE}${qs ? `?${qs}` : ""}`);
  }

  async getReview(id: string): Promise<StockPurchaseReviewDTO> {
    return apiGet(`${BASE}/${encodeURIComponent(id)}`);
  }

  async resolveLine(reviewId: string, lineId: string, payload: ResolveStockReviewLinePayload): Promise<StockPurchaseReviewDTO> {
    return apiPost(`${BASE}/${encodeURIComponent(reviewId)}/lines/${encodeURIComponent(lineId)}/resolve`, payload);
  }

  async getLineSuggestion(reviewId: string, lineId: string): Promise<StockReviewLineSuggestionDTO | null> {
    return apiGet(`${BASE}/${encodeURIComponent(reviewId)}/lines/${encodeURIComponent(lineId)}/suggestion`);
  }

  async decideUnresolved(reviewId: string, payload: DecideUnresolvedPayload): Promise<StockPurchaseReviewDTO> {
    return apiPost(`${BASE}/${encodeURIComponent(reviewId)}/decide-unresolved`, payload);
  }

  async confirmReview(reviewId: string, payload: ConfirmStockPurchaseReviewPayload): Promise<StockPurchaseReviewDTO> {
    return apiPost(`${BASE}/${encodeURIComponent(reviewId)}/confirm`, payload);
  }

  async cancelReview(reviewId: string, payload: CancelStockPurchaseReviewPayload): Promise<StockPurchaseReviewDTO> {
    return apiPost(`${BASE}/${encodeURIComponent(reviewId)}/cancel`, payload);
  }

  async listStockItemOptions(): Promise<StockItemOptionDTO[]> {
    const items = await apiGet<LegacyStockItem[]>("/api/stock/items");
    return items.map((i) => ({
      id: i.id,
      name: i.name,
      baseUnit: i.base_unit,
      categoryId: i.category_id,
      isActive: i.is_active,
    }));
  }

  async listStockCategoryOptions(): Promise<StockCategoryOptionDTO[]> {
    const categories = await apiGet<LegacyStockCategory[]>("/api/stock/categories");
    return categories.map((c) => ({ id: c.id, name: c.name }));
  }
}
