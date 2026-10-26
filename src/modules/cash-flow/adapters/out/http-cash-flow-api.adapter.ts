import { apiGet } from "../../../../lib/api.ts";
import type { CashFlowReport } from "../../domain/entities/cash-flow.ts";
import type { CashFlowApiPort } from "../../domain/ports/out/cash-flow-api.port.ts";

export class HttpCashFlowApiAdapter implements CashFlowApiPort {
  getCashFlow(year: number, month: number): Promise<CashFlowReport> {
    return apiGet<CashFlowReport>(`/api/reports/dre/fluxo-caixa?year=${year}&month=${month}`);
  }
}
