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
  SupplierReplenishmentRowDTO,
} from "../../entities/stock-planning.ts";

export interface StockPlanningApiPort {
  listItems(params: ListPlanningItemsParams): Promise<PlanningItemRowDTO[]>;
  getItemDetail(stockItemId: string, locationId: string): Promise<PlanningItemDetailDTO>;

  listAlerts(params: ListPlanningAlertsParams): Promise<PlanningAlertRowDTO[]>;
  getAlertDetail(alertId: string): Promise<PlanningAlertDetailDTO>;
  acknowledgeAlert(alertId: string): Promise<PlanningAlertRowDTO>;
  silenceAlert(alertId: string, payload: SilenceAlertPayload): Promise<PlanningAlertRowDTO>;

  getPurchaseList(locationId: string): Promise<SuggestedPurchaseListDTO>;
  /** Necessidades de reposição dos artigos de um fornecedor (separador Abastecimento). */
  listSupplierReplenishment(supplierId: string, locationId: string): Promise<SupplierReplenishmentRowDTO[]>;
  reviewRecommendation(recommendationId: string, payload: ReviewRecommendationPayload): Promise<void>;

  submitForecastFeedback(feedbackId: string, payload: SubmitForecastFeedbackPayload): Promise<void>;
  getForecastHistory(locationId: string, limit?: number): Promise<ForecastHistoryDTO>;

  /** Reaproveita `/api/stock/categories` (módulo legado), mesma fonte usada por `stock-purchase-review`. */
  listStockCategoryOptions(): Promise<StockCategoryOptionDTO[]>;
}
