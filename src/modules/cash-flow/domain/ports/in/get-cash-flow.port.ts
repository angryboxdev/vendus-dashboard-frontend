import type { CashFlowReport } from "../../entities/cash-flow.ts";

export interface GetCashFlowPort {
  execute(year: number, month: number): Promise<CashFlowReport>;
}
