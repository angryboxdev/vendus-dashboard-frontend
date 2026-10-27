import { ApiError, apiGet, apiPut } from "../../../../lib/api.ts";
import type { CashFlowReport, CashFlowToHandle } from "../../domain/entities/cash-flow.ts";
import type { DreParameters, DreReport, DreRestaurantSales, ResolvedDreParameters } from "../../domain/entities/dre.ts";
import type { SalesReconciliation } from "../../domain/entities/sales-reconciliation.ts";
import type { CashFlowApiPort } from "../../domain/ports/out/cash-flow-api.port.ts";

export class HttpCashFlowApiAdapter implements CashFlowApiPort {
  getCashFlow(year: number, month: number): Promise<CashFlowReport> {
    return apiGet<CashFlowReport>(`/api/reports/dre/fluxo-caixa?year=${year}&month=${month}`);
  }

  getDre(year: number, month: number, withRestaurantSales = true): Promise<DreReport> {
    return apiGet<DreReport>(`/api/reports/dre/resultado?year=${year}&month=${month}${withRestaurantSales ? "" : "&restaurante=0"}`);
  }

  getDreRestaurantSales(year: number, month: number): Promise<DreRestaurantSales> {
    return apiGet<DreRestaurantSales>(`/api/reports/dre/vendas-restaurante?year=${year}&month=${month}`);
  }

  getSalesReconciliation(year: number, month: number): Promise<SalesReconciliation> {
    return apiGet<SalesReconciliation>(`/api/reports/dre/conferencia-vendas?year=${year}&month=${month}`);
  }

  getDreParameters(year: number, month: number): Promise<ResolvedDreParameters> {
    return apiGet<ResolvedDreParameters>(`/api/reports/dre/parametros?year=${year}&month=${month}`);
  }

  saveDreParameters(year: number, month: number, parameters: DreParameters): Promise<ResolvedDreParameters> {
    return apiPut<ResolvedDreParameters>(`/api/reports/dre/parametros?year=${year}&month=${month}`, parameters);
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
