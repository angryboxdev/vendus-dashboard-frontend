import { apiGet } from "../../lib/api";
import type { VendusOrderDetail, VendusOrderSummary } from "./orders.types";

function normalizeList(payload: unknown): VendusOrderSummary[] {
  if (Array.isArray(payload)) return payload as VendusOrderSummary[];
  const p = payload as Record<string, unknown>;
  if (Array.isArray(p?.data)) return p.data as VendusOrderSummary[];
  if (Array.isArray(p?.documents)) return p.documents as VendusOrderSummary[];
  return [];
}

export async function fetchOrders(params: {
  since: string;
  until: string;
  type: string;
  perPage: number;
  page?: number;
}): Promise<VendusOrderSummary[]> {
  const qs = new URLSearchParams({
    since: params.since,
    until: params.until,
    type: params.type,
    per_page: String(params.perPage),
    page: String(params.page ?? 1),
  });
  const raw = await apiGet<unknown>(`/api/documents?${qs}`);
  return normalizeList(raw);
}

export async function fetchOrderDetail(id: string | number): Promise<VendusOrderDetail> {
  return apiGet<VendusOrderDetail>(`/api/documents/${id}`);
}
