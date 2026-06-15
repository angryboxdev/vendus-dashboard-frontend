import type { CashClosing, CashClosingStatus } from "../../entities/cash-closing.ts";

export interface ListClosingsParams {
  from?: string | undefined;
  to?: string | undefined;
  date?: string | undefined;
  status?: CashClosingStatus | undefined;
  employeeId?: string | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
}

export interface ReviewPatch {
  status?: CashClosingStatus | undefined;
  managerNotes?: string | null | undefined;
  tpa?: number | undefined;
  uber?: number | undefined;
  glovo?: number | undefined;
  bolt?: number | undefined;
  eatz?: number | undefined;
  cashSales?: number | undefined;
  cashIn?: number | undefined;
  cashOut?: number | undefined;
  cashDrawerOpen?: number | undefined;
  cashDrawerTotal?: number | undefined;
  notes?: string | null | undefined;
}

export interface SubmitClosingParams {
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
  notes?: string | null | undefined;
}

export interface CashClosingApiPort {
  listClosings(params: ListClosingsParams): Promise<{ closings: CashClosing[]; total: number }>;
  getClosing(id: string): Promise<CashClosing>;
  reviewClosing(id: string, patch: ReviewPatch): Promise<CashClosing>;
  verifyPin(pin: string): Promise<{ employeeId: string; fullName: string }>;
  getVendusTotal(date: string): Promise<number>;
  submitClosing(params: SubmitClosingParams): Promise<CashClosing>;
}
