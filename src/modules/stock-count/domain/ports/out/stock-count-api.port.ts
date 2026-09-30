import type {
  StockCountSessionDTO,
  StockCountSessionRowDTO,
  ListStockCountSessionsParams,
  CreateStockCountSessionPayload,
  StartStockCountSessionPayload,
  StockCountLineDTO,
  SubmitCountAttemptPayload,
  RequestRecountPayload,
  ResolveCountLinePayload,
  FinishExecutionPayload,
  MarkSessionReadyPayload,
  ConfirmStockCountSessionPayload,
  CancelStockCountSessionPayload,
  AddUnscopedItemPayload,
  StockCountZoneRowDTO,
  CreateStockCountZonePayload,
  StockItemOptionDTO,
  StockCategoryOptionDTO,
} from "../../entities/stock-count.ts";

export interface StockCountApiPort {
  listSessions(params?: ListStockCountSessionsParams): Promise<StockCountSessionRowDTO[]>;
  getSession(id: string): Promise<StockCountSessionDTO>;
  createSession(payload: CreateStockCountSessionPayload): Promise<StockCountSessionDTO>;
  /** Pode rejeitar com 403 (override sem ser admin) ou 400 (bloqueada por sobreposição, sem override). */
  startSession(id: string, payload: StartStockCountSessionPayload): Promise<StockCountSessionDTO>;
  /** Pode rejeitar com `ApiError` 409 `{ error, currentVersion }` — a UI deve recarregar a linha/sessão e avisar o utilizador. */
  submitCountAttempt(lineId: string, payload: SubmitCountAttemptPayload): Promise<StockCountLineDTO>;
  requestRecount(lineId: string, payload: RequestRecountPayload): Promise<StockCountLineDTO>;
  /** 403 se `manual_value` e o ator não for admin. */
  resolveCountLine(lineId: string, payload: ResolveCountLinePayload): Promise<StockCountLineDTO>;
  finishExecution(sessionId: string, payload: FinishExecutionPayload): Promise<StockCountSessionDTO>;
  markSessionReady(sessionId: string, payload: MarkSessionReadyPayload): Promise<StockCountSessionDTO>;
  /** 403 se o ator não for admin. */
  confirmSession(sessionId: string, payload: ConfirmStockCountSessionPayload): Promise<StockCountSessionDTO>;
  cancelSession(sessionId: string, payload: CancelStockCountSessionPayload): Promise<StockCountSessionDTO>;
  addUnscopedItem(sessionId: string, payload: AddUnscopedItemPayload): Promise<StockCountLineDTO>;

  listZones(locationId: string): Promise<StockCountZoneRowDTO[]>;
  createZone(payload: CreateStockCountZonePayload): Promise<StockCountZoneRowDTO>;

  /** Reaproveita `/api/stock/items` (módulo legado de stock) para o picker de escopo e para juntar nome/unidade a cada linha. */
  listStockItemOptions(): Promise<StockItemOptionDTO[]>;
  /** Reaproveita `/api/stock/categories` para o picker de escopo. */
  listStockCategoryOptions(): Promise<StockCategoryOptionDTO[]>;
}
