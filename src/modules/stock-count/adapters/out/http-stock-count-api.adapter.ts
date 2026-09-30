import { apiGet, apiPost } from "../../../../lib/api.ts";
import type { StockCountApiPort } from "../../domain/ports/out/stock-count-api.port.ts";
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
} from "../../domain/entities/stock-count.ts";

const BASE = "/api/stock-count";

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

export class HttpStockCountApiAdapter implements StockCountApiPort {
  async listSessions(params?: ListStockCountSessionsParams): Promise<StockCountSessionRowDTO[]> {
    const q = new URLSearchParams();
    if (params?.status) q.set("status", params.status);
    if (params?.locationId) q.set("locationId", params.locationId);
    if (params?.from) q.set("from", params.from);
    if (params?.to) q.set("to", params.to);
    const qs = q.toString();
    return apiGet(`${BASE}/sessions${qs ? `?${qs}` : ""}`);
  }

  async getSession(id: string): Promise<StockCountSessionDTO> {
    return apiGet(`${BASE}/sessions/${encodeURIComponent(id)}`);
  }

  async createSession(payload: CreateStockCountSessionPayload): Promise<StockCountSessionDTO> {
    return apiPost(`${BASE}/sessions`, payload);
  }

  async startSession(id: string, payload: StartStockCountSessionPayload): Promise<StockCountSessionDTO> {
    return apiPost(`${BASE}/sessions/${encodeURIComponent(id)}/start`, payload);
  }

  async submitCountAttempt(lineId: string, payload: SubmitCountAttemptPayload): Promise<StockCountLineDTO> {
    return apiPost(`${BASE}/lines/${encodeURIComponent(lineId)}/attempts`, payload);
  }

  async requestRecount(lineId: string, payload: RequestRecountPayload): Promise<StockCountLineDTO> {
    return apiPost(`${BASE}/lines/${encodeURIComponent(lineId)}/request-recount`, payload);
  }

  async resolveCountLine(lineId: string, payload: ResolveCountLinePayload): Promise<StockCountLineDTO> {
    return apiPost(`${BASE}/lines/${encodeURIComponent(lineId)}/resolve`, payload);
  }

  async finishExecution(sessionId: string, payload: FinishExecutionPayload): Promise<StockCountSessionDTO> {
    return apiPost(`${BASE}/sessions/${encodeURIComponent(sessionId)}/finish-execution`, payload);
  }

  async markSessionReady(sessionId: string, payload: MarkSessionReadyPayload): Promise<StockCountSessionDTO> {
    return apiPost(`${BASE}/sessions/${encodeURIComponent(sessionId)}/mark-ready`, payload);
  }

  async confirmSession(sessionId: string, payload: ConfirmStockCountSessionPayload): Promise<StockCountSessionDTO> {
    return apiPost(`${BASE}/sessions/${encodeURIComponent(sessionId)}/confirm`, payload);
  }

  async cancelSession(sessionId: string, payload: CancelStockCountSessionPayload): Promise<StockCountSessionDTO> {
    return apiPost(`${BASE}/sessions/${encodeURIComponent(sessionId)}/cancel`, payload);
  }

  async addUnscopedItem(sessionId: string, payload: AddUnscopedItemPayload): Promise<StockCountLineDTO> {
    return apiPost(`${BASE}/sessions/${encodeURIComponent(sessionId)}/unscoped-item`, payload);
  }

  async listZones(locationId: string): Promise<StockCountZoneRowDTO[]> {
    return apiGet(`${BASE}/zones?locationId=${encodeURIComponent(locationId)}`);
  }

  async createZone(payload: CreateStockCountZonePayload): Promise<StockCountZoneRowDTO> {
    return apiPost(`${BASE}/zones`, payload);
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
