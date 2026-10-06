import { createContext, useContext, type ReactNode } from "react";
import { HttpStockCountApiAdapter } from "./adapters/out/http-stock-count-api.adapter.ts";
import type { StockCountApiPort } from "./domain/ports/out/stock-count-api.port.ts";

export interface StockCountModule {
  api: StockCountApiPort;
}

function buildModule(): StockCountModule {
  return { api: new HttpStockCountApiAdapter() };
}

const StockCountContext = createContext<StockCountModule | null>(null);

export function StockCountProvider({
  children,
  module: mod,
}: {
  children: ReactNode;
  module?: StockCountModule;
}) {
  const value = mod ?? buildModule();
  return <StockCountContext.Provider value={value}>{children}</StockCountContext.Provider>;
}

export function useStockCountModule(): StockCountModule {
  const ctx = useContext(StockCountContext);
  if (!ctx) throw new Error("useStockCountModule must be used inside StockCountProvider");
  return ctx;
}
