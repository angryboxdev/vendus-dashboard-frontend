import { createContext, useContext, type ReactNode } from "react";
import { HttpCashFlowApiAdapter } from "./adapters/out/http-cash-flow-api.adapter.ts";
import { GetCashFlowUseCase } from "./application/use-cases/get-cash-flow.use-case.ts";
import type { GetCashFlowPort } from "./domain/ports/in/get-cash-flow.port.ts";

export interface CashFlowModule {
  getCashFlow: GetCashFlowPort;
}

/** Composition root: liga o adapter HTTP ao caso de uso. */
function buildModule(): CashFlowModule {
  return { getCashFlow: new GetCashFlowUseCase(new HttpCashFlowApiAdapter()) };
}

const CashFlowContext = createContext<CashFlowModule | null>(null);

export function CashFlowProvider({ children, module: mod }: { children: ReactNode; module?: CashFlowModule }) {
  const value = mod ?? buildModule();
  return <CashFlowContext.Provider value={value}>{children}</CashFlowContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCashFlowModule(): CashFlowModule {
  const ctx = useContext(CashFlowContext);
  if (!ctx) throw new Error("useCashFlowModule must be used inside CashFlowProvider");
  return ctx;
}
