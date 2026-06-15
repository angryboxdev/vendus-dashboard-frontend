import type { CashClosing, CashClosingStatus } from "../../entities/cash-closing.ts";

export interface ListClosingsQuery {
  from?: string | undefined;
  to?: string | undefined;
  date?: string | undefined;
  status?: CashClosingStatus | undefined;
  employeeId?: string | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
}

export interface ListClosingsPort {
  execute(query: ListClosingsQuery): Promise<{ closings: CashClosing[]; total: number }>;
}
