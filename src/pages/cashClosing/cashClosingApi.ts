import { apiGet, apiPatch, apiPost, API_BASE } from "../../lib/api";

const BASE = "/api/cash-closings";

export type CashClosingStatus = "pending" | "approved" | "rejected";

export type CashClosing = {
  id: string;
  closingDate: string;
  employeeId: string;
  employeeName: string;
  tpa: number;
  uber: number;
  glovo: number;
  bolt: number;
  eatz: number;
  cashSales: number;
  cashIn: number;
  cashOut: number;
  cashDrawerOpen: number;
  cashDrawerTotal: number;
  totalCalculated: number;
  vendusTotal: number | null;
  sangriaAmount: number;
  notes: string | null;
  status: CashClosingStatus;
  managerNotes: string | null;
  reviewedAt: string | null;
  submittedAt: string;
};

export type VerifyPinResult = {
  employeeId: string;
  fullName: string;
};

export async function verifyPin(pin: string): Promise<VerifyPinResult> {
  const url = `${API_BASE}${BASE}/verify-pin`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pin }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(data.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<VerifyPinResult>;
}

export async function getVendusTotal(date: string): Promise<number> {
  const url = `${API_BASE}${BASE}/vendus-total?date=${encodeURIComponent(date)}`;
  const res = await fetch(url);
  if (!res.ok) return 0;
  const data = await res.json() as { total: number };
  return data.total;
}

export type SubmitClosingBody = {
  employeeId: string;
  closingDate: string;
  tpa: number;
  uber: number;
  glovo: number;
  bolt: number;
  eatz: number;
  cashSales: number;
  cashIn: number;
  cashOut: number;
  cashDrawerOpen: number;
  cashDrawerTotal: number;
  notes?: string | null;
};

export async function submitClosing(body: SubmitClosingBody): Promise<CashClosing> {
  const url = `${API_BASE}${BASE}/submit`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(data.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<CashClosing>;
}

export type ListClosingsParams = {
  date?: string;
  status?: CashClosingStatus | "";
  employeeId?: string;
  limit?: number;
  offset?: number;
};

export async function fetchClosings(
  params: ListClosingsParams = {},
): Promise<{ closings: CashClosing[]; total: number }> {
  const q = new URLSearchParams();
  if (params.date) q.set("date", params.date);
  if (params.status) q.set("status", params.status);
  if (params.employeeId) q.set("employeeId", params.employeeId);
  if (params.limit != null) q.set("limit", String(params.limit));
  if (params.offset != null) q.set("offset", String(params.offset));
  const qs = q.toString();
  return apiGet(`${BASE}${qs ? `?${qs}` : ""}`);
}

export async function fetchClosing(id: string): Promise<CashClosing> {
  return apiGet(`${BASE}/${encodeURIComponent(id)}`);
}

export type PatchClosingBody = {
  status?: CashClosingStatus;
  managerNotes?: string | null;
  tpa?: number;
  uber?: number;
  glovo?: number;
  bolt?: number;
  eatz?: number;
  cashSales?: number;
  cashIn?: number;
  cashOut?: number;
  cashDrawerOpen?: number;
  cashDrawerTotal?: number;
  notes?: string | null;
};

export async function patchClosing(id: string, body: PatchClosingBody): Promise<CashClosing> {
  return apiPatch(`${BASE}/${encodeURIComponent(id)}`, body);
}
