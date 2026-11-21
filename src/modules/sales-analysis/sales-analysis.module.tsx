import { createContext, useContext, useMemo, type ReactNode } from "react";
import { HttpSalesAnalysisApiAdapter } from "./adapters/out/http-sales-analysis-api.adapter.ts";
import { FetchAirMenuMonthUseCase, GetSalesAnalysisUseCase, GetSalesForecastUseCase } from "./application/use-cases/sales-analysis.use-cases.ts";
import { lisbonToday } from "./domain/services/periods.ts";
import type { FetchAirMenuMonthPort, GetSalesAnalysisPort, GetSalesForecastPort } from "./domain/ports/in/sales-analysis.ports.ts";

export interface SalesAnalysisModule {
  getAnalysis: GetSalesAnalysisPort;
  fetchAirMenuMonth: FetchAirMenuMonthPort;
  getForecast: GetSalesForecastPort;
  /** Hoje em Lisboa (AAAA-MM-DD). */
  today: () => string;
}

/** Composition root: o único sítio que conhece o adapter HTTP. */
function buildModule(): SalesAnalysisModule {
  const api = new HttpSalesAnalysisApiAdapter();
  return {
    getAnalysis: new GetSalesAnalysisUseCase(api, lisbonToday),
    fetchAirMenuMonth: new FetchAirMenuMonthUseCase(api),
    getForecast: new GetSalesForecastUseCase(api),
    today: lisbonToday,
  };
}

const SalesAnalysisContext = createContext<SalesAnalysisModule | null>(null);

export function SalesAnalysisProvider({ children, module: mod }: { children: ReactNode; module?: SalesAnalysisModule }) {
  const value = useMemo(() => mod ?? buildModule(), [mod]);
  return <SalesAnalysisContext.Provider value={value}>{children}</SalesAnalysisContext.Provider>;
}

export function useSalesAnalysisModule(): SalesAnalysisModule {
  const ctx = useContext(SalesAnalysisContext);
  if (!ctx) throw new Error("useSalesAnalysisModule must be used inside SalesAnalysisProvider");
  return ctx;
}
