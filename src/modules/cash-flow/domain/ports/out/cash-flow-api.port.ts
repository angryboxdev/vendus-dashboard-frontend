import type { CashFlowReport, CashFlowToHandle } from "../../entities/cash-flow.ts";
import type { DreReport } from "../../entities/dre.ts";

export interface CashFlowApiPort {
  getCashFlow(year: number, month: number): Promise<CashFlowReport>;
  /** null sem permissão (403). */
  getToHandle(): Promise<CashFlowToHandle | null>;
  getDre(year: number, month: number): Promise<DreReport>;
}
