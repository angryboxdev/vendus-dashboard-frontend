import { createContext, useContext, type ReactNode } from "react";
import { HttpCashClosingApiAdapter } from "./adapters/out/http-cash-closing-api.adapter.ts";
import { ListClosingsUseCase } from "./application/use-cases/list-closings.use-case.ts";
import { ReviewClosingUseCase } from "./application/use-cases/review-closing.use-case.ts";
import type { ListClosingsPort } from "./domain/ports/in/list-closings.port.ts";
import type { ReviewClosingPort } from "./domain/ports/in/review-closing.port.ts";
import type { CashClosingApiPort } from "./domain/ports/out/cash-closing-api.port.ts";

export interface CashClosingsModule {
  listClosings: ListClosingsPort;
  reviewClosing: ReviewClosingPort;
  /** Acesso directo ao port para operações do kiosk (verifyPin, submitClosing, getVendusTotal). */
  api: CashClosingApiPort;
}

/**
 * Composition root: instancia os adapters concretos e injeta nos use cases.
 * Para trocar de provider basta substituir HttpCashClosingApiAdapter.
 */
function buildModule(): CashClosingsModule {
  const api = new HttpCashClosingApiAdapter();
  return {
    listClosings: new ListClosingsUseCase(api),
    reviewClosing: new ReviewClosingUseCase(api),
    api,
  };
}

const CashClosingsContext = createContext<CashClosingsModule | null>(null);

export function CashClosingsProvider({
  children,
  module: mod,
}: {
  children: ReactNode;
  module?: CashClosingsModule;
}) {
  const value = mod ?? buildModule();
  return (
    <CashClosingsContext.Provider value={value}>
      {children}
    </CashClosingsContext.Provider>
  );
}

export function useCashClosingsModule(): CashClosingsModule {
  const ctx = useContext(CashClosingsContext);
  if (!ctx) {
    throw new Error("useCashClosingsModule must be used inside CashClosingsProvider");
  }
  return ctx;
}
