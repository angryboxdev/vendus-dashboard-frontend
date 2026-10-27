import type { SalesReconciliation } from "../../entities/sales-reconciliation.ts";

export interface GetSalesReconciliationPort {
  execute(year: number, month: number): Promise<SalesReconciliation>;
}
