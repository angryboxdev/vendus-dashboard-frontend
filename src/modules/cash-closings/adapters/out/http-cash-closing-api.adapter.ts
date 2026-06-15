import { apiGet, apiPatch, API_BASE } from "../../../../lib/api.ts";
import type {
  CashClosingApiPort,
  ListClosingsParams,
  ReviewPatch,
  SubmitClosingParams,
} from "../../domain/ports/out/cash-closing-api.port.ts";
import type { CashClosing } from "../../domain/entities/cash-closing.ts";

const BASE = "/api/cash-closings";

export class HttpCashClosingApiAdapter implements CashClosingApiPort {
  async listClosings(
    params: ListClosingsParams,
  ): Promise<{ closings: CashClosing[]; total: number }> {
    const q = new URLSearchParams();
    if (params.from) q.set("from", params.from);
    if (params.to) q.set("to", params.to);
    if (params.date) q.set("date", params.date);
    if (params.status) q.set("status", params.status);
    if (params.employeeId) q.set("employeeId", params.employeeId);
    if (params.limit != null) q.set("limit", String(params.limit));
    if (params.offset != null) q.set("offset", String(params.offset));
    const qs = q.toString();
    return apiGet(`${BASE}${qs ? `?${qs}` : ""}`);
  }

  async getClosing(id: string): Promise<CashClosing> {
    return apiGet(`${BASE}/${encodeURIComponent(id)}`);
  }

  async reviewClosing(id: string, patch: ReviewPatch): Promise<CashClosing> {
    return apiPatch(`${BASE}/${encodeURIComponent(id)}`, patch);
  }

  async verifyPin(pin: string): Promise<{ employeeId: string; fullName: string }> {
    const url = `${API_BASE}${BASE}/verify-pin`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(data.error ?? `HTTP ${res.status}`);
    }
    return res.json() as Promise<{ employeeId: string; fullName: string }>;
  }

  async getVendusTotal(date: string): Promise<number> {
    const url = `${API_BASE}${BASE}/vendus-total?date=${encodeURIComponent(date)}`;
    const res = await fetch(url);
    if (!res.ok) return 0;
    const data = (await res.json()) as { total: number };
    return data.total;
  }

  async submitClosing(params: SubmitClosingParams): Promise<CashClosing> {
    const url = `${API_BASE}${BASE}/submit`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(data.error ?? `HTTP ${res.status}`);
    }
    return res.json() as Promise<CashClosing>;
  }
}
