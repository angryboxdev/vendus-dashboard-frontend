import { ApiError, apiGet } from "../../../../lib/api.ts";
import type { CashFlowReport, CashFlowToHandle } from "../../domain/entities/cash-flow.ts";
import type { CashFlowApiPort } from "../../domain/ports/out/cash-flow-api.port.ts";

export class HttpCashFlowApiAdapter implements CashFlowApiPort {
  getCashFlow(year: number, month: number): Promise<CashFlowReport> {
    return apiGet<CashFlowReport>(`/api/reports/dre/fluxo-caixa?year=${year}&month=${month}`);
  }

  async getToHandle(): Promise<CashFlowToHandle | null> {
    try {
      return await apiGet<CashFlowToHandle>("/api/reports/dre/fluxo-caixa/para-tratar");
    } catch (err) {
      // Sem permissão de Contas a pagar: o painel simplesmente não aparece.
      if (err instanceof ApiError && err.status === 403) return null;
      throw err;
    }
  }
}
