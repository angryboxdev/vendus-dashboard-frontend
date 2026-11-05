import { ApiError, apiGet, apiWrite } from "../../../../lib/api.ts";
import type { DaySummary, ImportPreview, ImportResult, PosEmployee, PosProduct, PosSale, PosSettings, PosView, ProductPatch, ReceiptDocument, StockAdjustment, StockDay } from "../../domain/entities/pos.ts";
import { PosError } from "../../domain/errors.ts";
import type { CheckoutRequest, PosApiPort, PosIdGeneratorPort, SeriesOption } from "../../domain/ports/out/pos-api.port.ts";

const B = "/api/pos";

/** 403 (PIN/gestor) e 400/404/409/422 (regras, recusa fiscal) → mensagem do Problem Details para o ecrã. */
function translate(e: unknown): never {
  if (e instanceof ApiError) {
    const detail = (e.data as { detail?: unknown } | undefined)?.detail;
    if (typeof detail === "string") {
      if (e.status === 403) throw new PosError(detail, "pin");
      if ([400, 404, 409, 422, 503].includes(e.status)) throw new PosError(detail, "rule");
    }
  }
  throw e;
}

async function write<T>(path: string, body: unknown, key: string, method: "POST" | "PUT" = "POST"): Promise<T> {
  try {
    return (await apiWrite<T>(path, { method, body, idempotencyKey: key })).data;
  } catch (e) {
    translate(e);
  }
}

async function get<T>(path: string): Promise<T> {
  try {
    return await apiGet<T>(path);
  } catch (e) {
    translate(e);
  }
}

const key = () => crypto.randomUUID();

export class HttpPosApiAdapter implements PosApiPort {
  products(activeOnly: boolean) {
    return get<PosProduct[]>(`${B}/products${activeOnly ? "?active=1" : ""}`);
  }
  updateProduct(id: string, patch: ProductPatch) {
    return write<PosProduct>(`${B}/products/${encodeURIComponent(id)}`, patch, key(), "PUT");
  }
  async adjustStock(productId: string, adjustment: StockAdjustment) {
    await write<unknown>(`${B}/products/${encodeURIComponent(productId)}/stock`, adjustment, key());
  }
  stockDay(date?: string) {
    return get<StockDay>(`${B}/stock${date ? `?date=${date}` : ""}`);
  }
  previewImport(csv: string) {
    return write<ImportPreview>(`${B}/products/import/preview`, { csv }, key());
  }
  importProducts(csv: string, opts: { replace?: boolean } = {}) {
    return write<ImportResult>(`${B}/products/import`, { csv, replace: opts.replace === true }, key());
  }
  settings() {
    return get<PosSettings>(`${B}/settings`);
  }
  saveSettings(s: PosSettings) {
    return write<PosSettings>(`${B}/settings`, s, key(), "PUT");
  }
  employees() {
    return get<PosEmployee[]>(`${B}/employees`);
  }
  async series(): Promise<SeriesOption[]> {
    const list = await get<Array<SeriesOption & { status?: string }>>("/api/invoicing/series");
    return list.filter((s) => (s.status ?? "active") === "active");
  }
  login(pin: string) {
    return write<PosEmployee>(`${B}/pin`, { pin }, key());
  }
  async setView(pin: string, view: PosView) {
    await write<unknown>(`${B}/view`, { pin, view }, key(), "PUT");
  }
  checkout(req: CheckoutRequest, idempotencyKey: string) {
    return write<PosSale>(`${B}/sales`, req, idempotencyKey);
  }
  refund(saleId: string, req: { pin: string; lines: Array<{ lineNumber: number; quantity: number }>; reason: string }, idempotencyKey: string) {
    return write<PosSale>(`${B}/sales/${encodeURIComponent(saleId)}/refund`, req, idempotencyKey);
  }
  documents(date?: string) {
    return get<PosSale[]>(`${B}/documents${date ? `?date=${date}` : ""}`);
  }
  summary(date?: string) {
    return get<DaySummary>(`${B}/summary${date ? `?date=${date}` : ""}`);
  }
  receipt(documentId: string) {
    return get<ReceiptDocument>(`/api/invoicing/documents/${encodeURIComponent(documentId)}`);
  }
}

export class CryptoPosIdGenerator implements PosIdGeneratorPort {
  next() {
    return crypto.randomUUID();
  }
}
