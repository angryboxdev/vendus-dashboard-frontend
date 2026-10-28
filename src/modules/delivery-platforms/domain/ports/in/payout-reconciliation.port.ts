import type { PayoutReconciliation } from "../../entities/payout-reconciliation.ts";

/** Transferências que pagam as vendas do mês × créditos no banco. */
export interface GetPayoutReconciliationPort {
  execute(year: number, month: number): Promise<PayoutReconciliation>;
}
