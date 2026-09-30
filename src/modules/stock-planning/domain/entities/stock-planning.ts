/**
 * "Planeamento de stock" (Stock Intelligence 3.0) — previsão de procura,
 * projeção de stock, alertas e lista de compras sugerida. Nunca cria
 * encomendas nem move stock sozinho: só sugere, alerta e explica; qualquer
 * ação real (comprar, ajustar stock) continua a acontecer noutros módulos
 * (Compras por rever / Contagens de stock).
 *
 * DTOs transcritos de
 * `stock-planning/domain/ports/in/stock-planning.ports.ts` (backend) —
 * fonte de verdade, ver ali antes de alterar aqui.
 */

// ── Enums / literais (transcritos dos serviços de domínio do backend) ──────

export type RiskLevel = "critico" | "atencao" | "excesso" | "ok";

export const RISK_LEVEL_LABELS: Record<RiskLevel, string> = {
  critico: "Crítico",
  atencao: "Atenção",
  excesso: "Excesso",
  ok: "OK",
};

export type ConfidenceLevel = "alta" | "media" | "baixa";

export const CONFIDENCE_LEVEL_LABELS: Record<ConfidenceLevel, string> = {
  alta: "Alta",
  media: "Média",
  baixa: "Baixa",
};

export type PlanningAlertType = "stockout_risk" | "excess_stock" | "price_anomaly" | "data_quality_warning";

export const PLANNING_ALERT_TYPE_LABELS: Record<PlanningAlertType, string> = {
  stockout_risk: "Risco de rutura",
  excess_stock: "Possível excesso",
  price_anomaly: "Variação de preço",
  data_quality_warning: "Qualidade de dados",
};

export type PlanningAlertSeverity = "baixa" | "media" | "alta" | "critica";

export const PLANNING_ALERT_SEVERITY_LABELS: Record<PlanningAlertSeverity, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  critica: "Crítica",
};

export type PlanningAlertState = "active" | "acknowledged" | "silenced" | "resolved";

export const PLANNING_ALERT_STATE_LABELS: Record<PlanningAlertState, string> = {
  active: "Ativo",
  acknowledged: "Reconhecido",
  silenced: "Silenciado",
  resolved: "Resolvido",
};

export type ForecastRunStatus = "running" | "completed" | "failed";

export const FORECAST_RUN_STATUS_LABELS: Record<ForecastRunStatus, string> = {
  running: "Em execução",
  completed: "Concluído",
  failed: "Falhou",
};

export type DemandSourceType = "pizza" | "stock";

// ── DTOs partilhados ──────────────────────────────────────────────────────

export interface PlanningItemRowDTO {
  stockItemId: string;
  name: string;
  categoryId: string;
  baseUnit: string;
  currentQuantity: number;
  coverageDays: number | null;
  ruptureDate: string | null;
  riskLevel: RiskLevel;
  confidence: ConfidenceLevel;
  suggestedPurchaseQty: number | null;
  purchaseUnit: string | null;
  supplierId: string | null;
}

export interface ProjectionPoint {
  date: string;
  expectedConsumption: number;
  cumulativeConsumption: number;
  projectedStock: number;
}

export interface DemandPointDTO {
  date: string;
  predictedQuantity: number;
  actualQuantity: number | null;
}

export interface AffectedProductSummary {
  demandSourceType: DemandSourceType;
  demandSourceRef: string;
  contributedQty: number;
}

export interface QualityFlagsDTO {
  hasIncompleteMapping: boolean;
  hasNegativeOrStaleStock: boolean;
  pendingReviewsAffectingItem: boolean;
  lastPhysicalCountAt: string | null;
}

export interface RecommendationExplanationDTO {
  recommendationId: string | null;
  stockNow: number;
  targetStock: number;
  safetyStock: number;
  projectedAtWindow: number | null;
  suggestedBaseQty: number;
  suggestedPurchaseQty: number | null;
  purchaseUnit: string | null;
  estimatedCost: number | null;
  nextDeliveryDate: string | null;
  followingDeliveryDate: string | null;
  explanationData: Record<string, unknown>;
}

export interface PlanningItemDetailDTO extends PlanningItemRowDTO {
  projection: ProjectionPoint[];
  demandPoints: DemandPointDTO[];
  affectedProducts: AffectedProductSummary[];
  quality: QualityFlagsDTO;
  recommendation: RecommendationExplanationDTO | null;
}

export interface PlanningAlertRowDTO {
  id: string;
  itemId: string;
  itemName: string;
  alertType: PlanningAlertType;
  severity: PlanningAlertSeverity;
  state: PlanningAlertState;
  firstDetectedAt: string;
  lastUpdatedAt: string;
  resolvedAt: string | null;
}

export interface PlanningAlertDetailDTO extends PlanningAlertRowDTO {
  contextSnapshot: Record<string, unknown>;
  projection: ProjectionPoint[];
  affectedProducts: AffectedProductSummary[];
  quality: QualityFlagsDTO;
  explanation: string;
}

export interface SuggestedPurchaseListLineDTO {
  recommendationId: string;
  stockItemId: string;
  itemName: string;
  suggestedBaseQty: number;
  suggestedPurchaseQty: number | null;
  purchaseUnit: string | null;
  estimatedCost: number | null;
}

export interface SuggestedPurchaseListGroupDTO {
  supplierId: string | null;
  supplierName: string;
  lines: SuggestedPurchaseListLineDTO[];
  totalEstimatedCost: number | null;
}

export interface SuggestedPurchaseListDTO {
  runId: string;
  generatedAt: string;
  groups: SuggestedPurchaseListGroupDTO[];
}

export interface ForecastRunSummaryDTO {
  id: string;
  generatedAt: string;
  dataCutoffAt: string;
  horizonStart: string;
  horizonEnd: string;
  status: ForecastRunStatus;
  qualityScore: number | null;
  isLatest: boolean;
}

export interface ForecastDeviationRowDTO {
  feedbackId: string;
  periodDate: string;
  forecastValue: number;
  actualValue: number;
  deviationPercent: number | null;
  hasFeedback: boolean;
  reasonCode: string | null;
}

export interface ForecastHistoryDTO {
  runs: ForecastRunSummaryDTO[];
  recentDeviations: ForecastDeviationRowDTO[];
}

// ── Payloads de escrita ──────────────────────────────────────────────────────

export interface ListPlanningItemsParams {
  locationId: string;
  categoryId?: string;
  supplierId?: string;
  riskLevel?: RiskLevel;
  search?: string;
}

export interface ListPlanningAlertsParams {
  locationId: string;
  state?: PlanningAlertState;
  alertType?: PlanningAlertType;
}

export interface SilenceAlertPayload {
  reason: string;
  until?: string | null;
}

export interface ReviewRecommendationPayload {
  reviewedQty: number;
  reason?: string | null;
}

export interface SubmitForecastFeedbackPayload {
  reasonCode: string;
  comment?: string | null;
}

// ── Pickers (reaproveita os endpoints legados já usados por `stock-purchase-review`) ──

export interface StockCategoryOptionDTO {
  id: string;
  name: string;
}

/** Motivos de desvio oferecidos na drawer de feedback (secção "Ontem as vendas foram diferentes do esperado"). */
export const FORECAST_FEEDBACK_REASON_OPTIONS: { value: string; label: string }[] = [
  { value: "event_busy_location", label: "Evento / local mais movimentado" },
  { value: "large_group_booking", label: "Grupo / reserva excecional" },
  { value: "promotion_campaign", label: "Promoção / campanha" },
  { value: "schedule_change", label: "Alteração de horário / operação" },
  { value: "holiday_special_date", label: "Feriado / data especial" },
  { value: "data_error", label: "Erro nos dados" },
  { value: "weather", label: "Clima" },
  { value: "unknown", label: "Não sei" },
  { value: "other", label: "Outro" },
];
