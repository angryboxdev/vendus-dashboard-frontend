import { apiGet, apiPatch, API_BASE } from "../../lib/api";

const BASE = "/api/cash-closings";

export type CashClosingStatus = "pending" | "approved" | "rejected";

export type DrawerDenominations = {
  notes50: number;
  notes20: number;
  notes10: number;
  notes5: number;
  coins200: number;
  coins100: number;
  coins50: number;
  coins20: number;
  coins10: number;
  coins1: number;
};

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
  drawerDenominations: DrawerDenominations | null;
  /** Sub-total dos canais Vendus declarados (TPA + Eatz + Dinheiro). */
  vendusCalculated: number;
  /** Sub-total dos canais AirMenu declarados (Uber + Glovo + Bolt). */
  airMenuCalculated: number;
  /** Soma dos totais AirMenu por plataforma (referência API). null se AirMenu indisponível. */
  airMenuTotal: number | null;
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


export type RegisterSessionDto = {
  openedAt: string;
  closedAt: string | null;
  total: number;
  alreadySubmitted: boolean;
};

export async function getSessions(date: string): Promise<RegisterSessionDto[]> {
  const url = `${API_BASE}${BASE}/sessions?date=${encodeURIComponent(date)}`;
  const res = await fetch(url);
  if (!res.ok) {
    const data = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(data.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<RegisterSessionDto[]>;
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
  sessionOpenedAt?: string | null;
  drawerDenominations?: DrawerDenominations | null;
};

export type AirMenuTotals = {
  uber: number;
  glovo: number;
  bolt: number;
};

export async function getAirMenuTotals(date: string): Promise<AirMenuTotals | null> {
  const url = `${API_BASE}/api/cash-closings/airmenu-totals?date=${encodeURIComponent(date)}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = (await res.json()) as AirMenuTotals | null;
  return data;
}

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
