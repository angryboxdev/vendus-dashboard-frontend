import type { CashFlowReport, CashFlowToHandle } from "../../entities/cash-flow.ts";

export interface CashFlowApiPort {
  getCashFlow(year: number, month: number): Promise<CashFlowReport>;
  /** null sem permissão (403). */
  getToHandle(): Promise<CashFlowToHandle | null>;
}
