import { apiGet, apiPost } from "../../../../lib/api.ts";
import type { StockPlanningApiPort } from "../../domain/ports/out/stock-planning-api.port.ts";
import type {
  PlanningItemRowDTO,
  PlanningItemDetailDTO,
  PlanningAlertRowDTO,
  PlanningAlertDetailDTO,
  SuggestedPurchaseListDTO,
  ForecastHistoryDTO,
  ListPlanningItemsParams,
  ListPlanningAlertsParams,
  SilenceAlertPayload,
  ReviewRecommendationPayload,
  SubmitForecastFeedbackPayload,
  StockCategoryOptionDTO,
} from "../../domain/entities/stock-planning.ts";

const BASE = "/api/stock-planning";

/** Forma devolvida por `/api/stock/categories` (módulo legado). */
interface LegacyStockCategory {
  id: string;
  name: string;
}

export class HttpStockPlanningApiAdapter implements StockPlanningApiPort {
  async listItems(params: ListPlanningItemsParams): Promise<PlanningItemRowDTO[]> {
    const q = new URLSearchParams();
    q.set("locationId", params.locationId);
    if (params.categoryId) q.set("categoryId", params.categoryId);
    if (params.supplierId) q.set("supplierId", params.supplierId);
    if (params.riskLevel) q.set("riskLevel", params.riskLevel);
    if (params.search) q.set("search", params.search);
    return apiGet(`${BASE}/items?${q.toString()}`);
  }

  async getItemDetail(stockItemId: string, locationId: string): Promise<PlanningItemDetailDTO> {
    const q = new URLSearchParams({ locationId });
    return apiGet(`${BASE}/items/${encodeURIComponent(stockItemId)}?${q.toString()}`);
  }

  async listAlerts(params: ListPlanningAlertsParams): Promise<PlanningAlertRowDTO[]> {
    const q = new URLSearchParams();
    q.set("locationId", params.locationId);
    if (params.state) q.set("state", params.state);
    if (params.alertType) q.set("alertType", params.alertType);
    return apiGet(`${BASE}/alerts?${q.toString()}`);
  }

  async getAlertDetail(alertId: string): Promise<PlanningAlertDetailDTO> {
    return apiGet(`${BASE}/alerts/${encodeURIComponent(alertId)}`);
  }

  async acknowledgeAlert(alertId: string): Promise<PlanningAlertRowDTO> {
    return apiPost(`${BASE}/alerts/${encodeURIComponent(alertId)}/acknowledge`, {});
  }

  async silenceAlert(alertId: string, payload: SilenceAlertPayload): Promise<PlanningAlertRowDTO> {
    return apiPost(`${BASE}/alerts/${encodeURIComponent(alertId)}/silence`, payload);
  }

  async getPurchaseList(locationId: string): Promise<SuggestedPurchaseListDTO> {
    const q = new URLSearchParams({ locationId });
    return apiGet(`${BASE}/purchase-list?${q.toString()}`);
  }

  async reviewRecommendation(recommendationId: string, payload: ReviewRecommendationPayload): Promise<void> {
    await apiPost(`${BASE}/recommendations/${encodeURIComponent(recommendationId)}/review`, payload);
  }

  async submitForecastFeedback(feedbackId: string, payload: SubmitForecastFeedbackPayload): Promise<void> {
    await apiPost(`${BASE}/feedback/${encodeURIComponent(feedbackId)}/submit`, payload);
  }

  async getForecastHistory(locationId: string, limit?: number): Promise<ForecastHistoryDTO> {
    const q = new URLSearchParams({ locationId });
    if (limit != null) q.set("limit", String(limit));
    return apiGet(`${BASE}/history?${q.toString()}`);
  }

  async listStockCategoryOptions(): Promise<StockCategoryOptionDTO[]> {
    const categories = await apiGet<LegacyStockCategory[]>("/api/stock/categories");
    return categories.map((c) => ({ id: c.id, name: c.name }));
  }
}
