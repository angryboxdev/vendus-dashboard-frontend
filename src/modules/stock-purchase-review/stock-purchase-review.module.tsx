import { createContext, useContext, type ReactNode } from "react";
import { HttpStockPurchaseReviewApiAdapter } from "./adapters/out/http-stock-purchase-review-api.adapter.ts";
import type { StockPurchaseReviewApiPort } from "./domain/ports/out/stock-purchase-review-api.port.ts";

export interface StockPurchaseReviewModule {
  api: StockPurchaseReviewApiPort;
}

function buildModule(): StockPurchaseReviewModule {
  return { api: new HttpStockPurchaseReviewApiAdapter() };
}

const StockPurchaseReviewContext = createContext<StockPurchaseReviewModule | null>(null);

export function StockPurchaseReviewProvider({
  children,
  module: mod,
}: {
  children: ReactNode;
  module?: StockPurchaseReviewModule;
}) {
  const value = mod ?? buildModule();
  return <StockPurchaseReviewContext.Provider value={value}>{children}</StockPurchaseReviewContext.Provider>;
}

export function useStockPurchaseReviewModule(): StockPurchaseReviewModule {
  const ctx = useContext(StockPurchaseReviewContext);
  if (!ctx) throw new Error("useStockPurchaseReviewModule must be used inside StockPurchaseReviewProvider");
  return ctx;
}
