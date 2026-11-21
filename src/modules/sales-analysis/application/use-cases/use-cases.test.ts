import { describe, expect, it } from "vitest";
import type { AirMenuMonthStatus, DateRange, ForecastResult, SalesAnalysisData, SourceSelection } from "../../domain/entities/sales-analysis.ts";
import type { SalesAnalysisApiPort } from "../../domain/ports/out/sales-analysis-api.port.ts";
import { FetchAirMenuMonthUseCase, GetSalesAnalysisUseCase, GetSalesForecastUseCase } from "./sales-analysis.use-cases.ts";

class FakeApi implements SalesAnalysisApiPort {
  calls: string[] = [];
  async getAnalysis(range: DateRange, source: SourceSelection): Promise<SalesAnalysisData> {
    this.calls.push(`get ${range.from}..${range.to} ${source}`);
    return { range, source } as SalesAnalysisData;
  }
  async fetchAirMenuMonth(month: string): Promise<AirMenuMonthStatus> {
    this.calls.push(`fetch ${month}`);
    return { month, state: "fetching" };
  }
  async getForecast(source: SourceSelection): Promise<ForecastResult> {
    this.calls.push(`forecast ${source}`);
    return { status: "pending", missingDays: 3 };
  }
}

describe("use cases da Análise de Vendas", () => {
  it("não pede ao servidor um período inválido", async () => {
    const api = new FakeApi();
    const uc = new GetSalesAnalysisUseCase(api, () => "2026-11-21");
    await expect(uc.execute({ from: "2025-01-01", to: "2026-11-21" }, "vendus")).rejects.toThrow("12 meses");
    expect(api.calls).toEqual([]);
    await uc.execute({ from: "2026-11-01", to: "2026-11-21" }, "both");
    expect(api.calls).toEqual(["get 2026-11-01..2026-11-21 both"]);
  });

  it("busca um mês da AirMenu só com mês válido", async () => {
    const api = new FakeApi();
    const uc = new FetchAirMenuMonthUseCase(api);
    await expect(uc.execute("2026-13")).rejects.toThrow("Mês inválido");
    expect(await uc.execute("2026-07")).toEqual({ month: "2026-07", state: "fetching" });
  });

  it("previsão passa a fonte escolhida", async () => {
    const api = new FakeApi();
    expect(await new GetSalesForecastUseCase(api).execute("airmenu")).toEqual({ status: "pending", missingDays: 3 });
    expect(api.calls).toEqual(["forecast airmenu"]);
  });
});
