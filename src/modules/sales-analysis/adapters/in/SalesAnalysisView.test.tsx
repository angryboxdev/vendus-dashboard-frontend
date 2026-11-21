import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { AirMenuMonthStatus, DateRange, ForecastResult, SalesAnalysisData, SourceSelection } from "../../domain/entities/sales-analysis.ts";
import { SalesAnalysisProvider, type SalesAnalysisModule } from "../../sales-analysis.module.tsx";
import { SalesAnalysisView } from "./SalesAnalysisView.tsx";

const TODAY = "2026-11-03";

function analysisData(range: DateRange, source: SourceSelection): SalesAnalysisData {
  return {
    today: TODAY,
    source,
    range,
    prevYearRange: { from: "2025-11-01", to: "2025-11-03" },
    prevMonthRange: { from: "2026-10-01", to: "2026-10-03" },
    channels: ["salao", "take_away", "eatz", "apps"],
    current: [
      ["2026-11-01", 20, 0, 30_000, 26_550, 10],
      ["2026-11-02", 13, 0, 12_000, 10_620, 5],
      ["2026-11-02", 20, 3, 8_000, 7_080, 3],
      ["2026-11-03", 13, 0, 5_000, 4_425, 2],
    ],
    prevYear: [["2025-11-01", -1, 0, 20_000, 17_700, 8]],
    prevMonth: [["2026-10-02", -1, 0, 15_000, 13_275, 6]],
    vendus: { missingDays: 0, fill: null, todayLive: true },
    airMenu: source === "vendus" ? null : { months: [{ month: "2026-11", state: "missing" }], comparisonMissingMonths: [] },
  };
}

function makeModule(log: string[]): SalesAnalysisModule {
  return {
    today: () => TODAY,
    getAnalysis: { execute: async (range, source) => { log.push(`get ${source}`); return analysisData(range, source); } },
    fetchAirMenuMonth: { execute: async (month): Promise<AirMenuMonthStatus> => { log.push(`fetch ${month}`); return { month, state: "fetching" }; } },
    getForecast: {
      execute: async (): Promise<ForecastResult> => ({
        status: "ready",
        forecast: {
          month: "2026-11", generatedAt: "", method: "ai", actualCents: 50_000,
          days: [{ date: "2026-11-03", expectedCents: 20_000, lowCents: 15_000, highCents: 25_000, expectedCount: 7 }, { date: "2026-11-04", expectedCents: 18_000, lowCents: 14_000, highCents: 22_000, expectedCount: 6 }],
          expectedTotalCents: 88_000, lowTotalCents: 79_000, highTotalCents: 97_000,
        },
      }),
    },
  };
}

function renderView(log: string[] = []) {
  render(<SalesAnalysisProvider module={makeModule(log)}><SalesAnalysisView /></SalesAnalysisProvider>);
  return log;
}

describe("SalesAnalysisView", () => {
  it("abre com a Vendus e o mês corrente, mostra cartões e a previsão com IA", async () => {
    const log = renderView();
    expect((await screen.findAllByText("Receita bruta")).length).toBeGreaterThan(0);
    expect(log).toEqual(["get vendus"]);
    expect(await screen.findByText("IA")).toBeInTheDocument();
    expect(screen.getByText(/^880\s€$/)).toBeInTheDocument();
  });

  it("dia mais forte abre o detalhe hora a hora com o n.º de vendas", async () => {
    renderView();
    await userEvent.click(await screen.findByRole("button", { name: /Dia mais forte/ }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Hora a hora")).toBeInTheDocument();
    expect(within(dialog).getByText("N.º de vendas")).toBeInTheDocument();
    expect(within(dialog).getAllByText("10").length).toBeGreaterThan(0);
  });

  it("AirMenu só é buscada ao clicar em «Buscar»", async () => {
    const log = renderView();
    await screen.findAllByText("Receita bruta");
    await userEvent.click(screen.getByRole("radio", { name: "Ambas" }));
    const buscar = await screen.findByRole("button", { name: "Buscar" });
    expect(log.filter((l) => l.startsWith("fetch"))).toEqual([]);
    await userEvent.click(buscar);
    expect(log).toContain("fetch 2026-11");
  });
});
