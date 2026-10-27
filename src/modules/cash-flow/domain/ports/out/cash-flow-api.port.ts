import type { CashFlowReport, CashFlowToHandle } from "../../entities/cash-flow.ts";
import type { DreParameters, DreReport, ResolvedDreParameters } from "../../entities/dre.ts";
import type { SalesReconciliation } from "../../entities/sales-reconciliation.ts";

export interface CashFlowApiPort {
  getCashFlow(year: number, month: number): Promise<CashFlowReport>;
  /** null sem permissão (403). */
  getToHandle(): Promise<CashFlowToHandle | null>;
  getDre(year: number, month: number): Promise<DreReport>;
  getSalesReconciliation(year: number, month: number): Promise<SalesReconciliation>;
  getDreParameters(year: number, month: number): Promise<ResolvedDreParameters>;
  saveDreParameters(year: number, month: number, parameters: DreParameters): Promise<ResolvedDreParameters>;
}
