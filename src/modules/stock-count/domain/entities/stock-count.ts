/**
 * "Contagem Física de Stock 2.0" — substitui o antigo botão "Atualizar
 * stock" (lançamento manual de deltas às cegas) por um fluxo com escopo
 * definido, stock teórico materializado no início, tentativas de contagem
 * auditadas, comparação com tolerância configurada, e só gera o ajuste real
 * de stock (`AJUSTE_CONTAGEM`) quando um admin confirma explicitamente.
 *
 * Fase 1 (minimal): sem wizard — formulário simples que já cria e inicia a
 * sessão, execução como lista simples (não swipe/carrossel), conferência
 * como tabela simples. Ver README do módulo para as simplificações
 * assumidas nesta fase.
 */

export type StockCountSessionStatus =
  | "draft"
  | "counting"
  | "reviewing"
  | "ready"
  | "completed"
  | "cancelled";

export const STOCK_COUNT_SESSION_STATUS_LABELS: Record<StockCountSessionStatus, string> = {
  draft: "Rascunho",
  counting: "Em contagem",
  reviewing: "Em conferência",
  ready: "Pronta",
  completed: "Concluída",
  cancelled: "Cancelada",
};

export type StockCountSessionType = "general" | "cyclical" | "spot";

export const STOCK_COUNT_SESSION_TYPE_LABELS: Record<StockCountSessionType, string> = {
  general: "Geral",
  cyclical: "Cíclica",
  spot: "Pontual",
};

export type StockCountLineStatus = "not_counted" | "counted" | "recount_required" | "resolved";

export const STOCK_COUNT_LINE_STATUS_LABELS: Record<StockCountLineStatus, string> = {
  not_counted: "Por contar",
  counted: "Contado",
  recount_required: "Recontagem necessária",
  resolved: "Resolvido",
};

/** `zoneIds` é só informativo nesta fase — nunca filtra quais itens entram na sessão (ver README do backend). */
export interface StockCountScopeDefinition {
  categoryIds?: string[];
  zoneIds?: string[];
  itemIds?: string[];
}

export interface TolerancePolicy {
  absoluteQty?: number;
  percent?: number;
  financialImpact?: number;
}

export interface StockCountComponentDTO {
  id: string;
  countAreaId: string | null;
  quantity: number;
  unit: string;
  conversionFactor: number;
  baseQuantity: number;
}

export interface StockCountAttemptDTO {
  id: string;
  attemptNumber: number;
  countStartedAt: string;
  countedAt: string;
  countedQuantity: number;
  systemQuantityAtCount: number;
  movementsDuringCount: boolean;
  countedBy: string;
  isManual: boolean;
  reason: string | null;
  components: StockCountComponentDTO[];
}

export interface StockCountLineDTO {
  id: string;
  sessionId: string;
  itemId: string;
  status: StockCountLineStatus;
  selectedAttemptId: string | null;
  finalCountedQuantity: number | null;
  finalSystemQuantity: number | null;
  finalVariance: number | null;
  variancePercent: number | null;
  varianceValue: number | null;
  toleranceSnapshot: TolerancePolicy | null;
  lockedBy: string | null;
  lockedAt: string | null;
  isUnscoped: boolean;
  version: number;
  attempts: StockCountAttemptDTO[];
}

export interface StockCountSessionDTO {
  id: string;
  locationId: string;
  type: StockCountSessionType;
  sessionNumber: number;
  status: StockCountSessionStatus;
  scopeDefinition: StockCountScopeDefinition;
  blindCount: boolean;
  businessDate: string;
  startedAt: string | null;
  startedBy: string | null;
  reviewStartedAt: string | null;
  readyAt: string | null;
  approvedAt: string | null;
  approvedBy: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  version: number;
  lines: StockCountLineDTO[];
  createdAt: string;
  updatedAt: string;
}

export interface StockCountSessionRowDTO {
  id: string;
  locationId: string;
  type: StockCountSessionType;
  sessionNumber: number;
  status: StockCountSessionStatus;
  businessDate: string;
  linesCount: number;
  linesPendingCount: number;
}

export interface ListStockCountSessionsParams {
  status?: StockCountSessionStatus;
  locationId?: string;
  from?: string;
  to?: string;
}

export interface CreateStockCountSessionPayload {
  locationId?: string | null;
  type: StockCountSessionType;
  scopeDefinition: StockCountScopeDefinition;
  businessDate: string;
}

export interface StartStockCountSessionPayload {
  expectedVersion: number;
  overrideOverlap?: boolean;
  overrideReason?: string;
}

export interface SubmitCountAttemptComponentPayload {
  countAreaId?: string;
  quantity: number;
  unit: string;
}

export interface SubmitCountAttemptPayload {
  expectedVersion: number;
  components: SubmitCountAttemptComponentPayload[];
  /** Capturado no frontend no momento em que o contador abre/foca o input — nunca no submit (deteta movimento durante a contagem). */
  countStartedAt: string;
  reason?: string;
}

export interface RequestRecountPayload {
  expectedVersion: number;
  reason?: string;
}

export type StockCountLineResolution = "select_attempt" | "manual_value";

export interface ResolveCountLinePayload {
  expectedVersion: number;
  resolution: StockCountLineResolution;
  /** Obrigatório para `select_attempt`. */
  selectedAttemptId?: string;
  /** Obrigatório para `manual_value` — admin only. */
  manualValue?: number;
  manualReason?: string;
}

export interface FinishExecutionPayload {
  expectedVersion: number;
}

export interface MarkSessionReadyPayload {
  expectedVersion: number;
}

export interface ConfirmStockCountSessionPayload {
  expectedVersion: number;
  businessDate?: string;
}

export interface CancelStockCountSessionPayload {
  reason: string;
  expectedVersion: number;
}

export interface AddUnscopedItemPayload {
  itemId?: string;
  newItem?: {
    name: string;
    categoryId: string;
    type: string;
    baseUnit: string;
  };
}

export interface StockCountZoneRowDTO {
  id: string;
  locationId: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
}

export interface CreateStockCountZonePayload {
  locationId: string;
  name: string;
  sortOrder?: number;
}

/** Corpo `{ error, currentVersion }` do 409 de conflito optimistic-lock. */
export interface StockCountVersionConflictData {
  error: string;
  currentVersion: number;
}

// ── Pickers (reaproveitam os endpoints já existentes do módulo de stock legado) ────

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
