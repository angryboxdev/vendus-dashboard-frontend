import { createContext, useContext, useMemo, type ReactNode } from "react";
import { HttpStockCatalogApiAdapter } from "./adapters/out/http-stock-catalog-api.adapter.ts";
import type { StockCatalogApiPort } from "./domain/ports/out/stock-catalog-api.port.ts";

export interface StockCatalogModule {
  api: StockCatalogApiPort;
}

function buildModule(): StockCatalogModule {
  return { api: new HttpStockCatalogApiAdapter() };
}

const StockCatalogContext = createContext<StockCatalogModule | null>(null);

export function StockCatalogProvider({ children, module: mod }: { children: ReactNode; module?: StockCatalogModule }) {
  const value = useMemo(() => mod ?? buildModule(), [mod]);
  return <StockCatalogContext.Provider value={value}>{children}</StockCatalogContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useStockCatalogModule(): StockCatalogModule {
  const ctx = useContext(StockCatalogContext);
  if (!ctx) throw new Error("useStockCatalogModule must be used inside StockCatalogProvider");
  return ctx;
}
