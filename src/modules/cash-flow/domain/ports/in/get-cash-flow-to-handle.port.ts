import type { CashFlowToHandle } from "../../entities/cash-flow.ts";

export interface GetCashFlowToHandlePort {
  /** null quando a pessoa não pode ver Contas a pagar (o painel não aparece). */
  execute(): Promise<CashFlowToHandle | null>;
}
