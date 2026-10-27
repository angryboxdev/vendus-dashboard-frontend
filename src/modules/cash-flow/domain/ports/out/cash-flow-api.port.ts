import type { CashFlowReport, CashFlowToHandle } from "../../entities/cash-flow.ts";
import type { DreParameters, DreReport, DreRestaurantSales, ResolvedDreParameters } from "../../entities/dre.ts";
import type { SalesReconciliation } from "../../entities/sales-reconciliation.ts";

export interface CashFlowApiPort {
  getCashFlow(year: number, month: number): Promise<CashFlowReport>;
  /** null sem permissão (403). */
  getToHandle(): Promise<CashFlowToHandle | null>;
  /** `withRestaurantSales: false` → rápido, sem as vendas do Vendus (`?restaurante=0`). */
  getDre(year: number, month: number, withRestaurantSales?: boolean): Promise<DreReport>;
  /** Só as vendas do restaurante (Vendus) — a parte lenta da DRE. */
  getDreRestaurantSales(year: number, month: number): Promise<DreRestaurantSales>;
  getSalesReconciliation(year: number, month: number): Promise<SalesReconciliation>;
  getDreParameters(year: number, month: number): Promise<ResolvedDreParameters>;
  saveDreParameters(year: number, month: number, parameters: DreParameters): Promise<ResolvedDreParameters>;
}
