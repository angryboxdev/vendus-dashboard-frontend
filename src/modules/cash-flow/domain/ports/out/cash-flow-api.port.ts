import type { CashFlowReport } from "../../entities/cash-flow.ts";

export interface CashFlowApiPort {
  getCashFlow(year: number, month: number): Promise<CashFlowReport>;
}
