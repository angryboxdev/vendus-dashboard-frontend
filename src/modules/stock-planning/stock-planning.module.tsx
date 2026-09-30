import { createContext, useContext, type ReactNode } from "react";
import { HttpStockPlanningApiAdapter } from "./adapters/out/http-stock-planning-api.adapter.ts";
import type { StockPlanningApiPort } from "./domain/ports/out/stock-planning-api.port.ts";

export interface StockPlanningModule {
  api: StockPlanningApiPort;
}

function buildModule(): StockPlanningModule {
  return { api: new HttpStockPlanningApiAdapter() };
}

const StockPlanningContext = createContext<StockPlanningModule | null>(null);

export function StockPlanningProvider({
  children,
  module: mod,
}: {
  children: ReactNode;
  module?: StockPlanningModule;
}) {
  const value = mod ?? buildModule();
  return <StockPlanningContext.Provider value={value}>{children}</StockPlanningContext.Provider>;
}

export function useStockPlanningModule(): StockPlanningModule {
  const ctx = useContext(StockPlanningContext);
  if (!ctx) throw new Error("useStockPlanningModule must be used inside StockPlanningProvider");
  return ctx;
}
