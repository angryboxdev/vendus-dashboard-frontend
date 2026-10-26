import { createContext, useContext, type ReactNode } from "react";
import { HttpCashFlowApiAdapter } from "./adapters/out/http-cash-flow-api.adapter.ts";
import { GetCashFlowUseCase } from "./application/use-cases/get-cash-flow.use-case.ts";
import { GetCashFlowToHandleUseCase } from "./application/use-cases/get-cash-flow-to-handle.use-case.ts";
import { GetDreUseCase } from "./application/use-cases/get-dre.use-case.ts";
import type { GetCashFlowPort } from "./domain/ports/in/get-cash-flow.port.ts";
import type { GetCashFlowToHandlePort } from "./domain/ports/in/get-cash-flow-to-handle.port.ts";
import type { GetDrePort } from "./domain/ports/in/get-dre.port.ts";

export interface CashFlowModule {
  getCashFlow: GetCashFlowPort;
  getToHandle: GetCashFlowToHandlePort;
  getDre: GetDrePort;
}

/** Composition root: liga o adapter HTTP aos casos de uso. */
function buildModule(): CashFlowModule {
  const api = new HttpCashFlowApiAdapter();
  return {
    getCashFlow: new GetCashFlowUseCase(api),
    getToHandle: new GetCashFlowToHandleUseCase(api),
    getDre: new GetDreUseCase(api),
  };
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
