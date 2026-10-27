import { createContext, useContext, type ReactNode } from "react";
import { HttpCashFlowApiAdapter } from "./adapters/out/http-cash-flow-api.adapter.ts";
import { GetCashFlowUseCase } from "./application/use-cases/get-cash-flow.use-case.ts";
import { GetCashFlowToHandleUseCase } from "./application/use-cases/get-cash-flow-to-handle.use-case.ts";
import { GetDreUseCase } from "./application/use-cases/get-dre.use-case.ts";
import { GetDreRestaurantSalesUseCase } from "./application/use-cases/get-dre-restaurant-sales.use-case.ts";
import { GetSalesReconciliationUseCase } from "./application/use-cases/sales-reconciliation.use-case.ts";
import { GetDreParametersUseCase, SaveDreParametersUseCase } from "./application/use-cases/dre-parameters.use-case.ts";
import type { GetCashFlowPort } from "./domain/ports/in/get-cash-flow.port.ts";
import type { GetCashFlowToHandlePort } from "./domain/ports/in/get-cash-flow-to-handle.port.ts";
import type { GetDrePort } from "./domain/ports/in/get-dre.port.ts";
import type { GetDreRestaurantSalesPort } from "./domain/ports/in/get-dre-restaurant-sales.port.ts";
import type { GetSalesReconciliationPort } from "./domain/ports/in/sales-reconciliation.port.ts";
import type { GetDreParametersPort, SaveDreParametersPort } from "./domain/ports/in/dre-parameters.port.ts";

export interface CashFlowModule {
  getCashFlow: GetCashFlowPort;
  getToHandle: GetCashFlowToHandlePort;
  getDre: GetDrePort;
  getDreRestaurantSales: GetDreRestaurantSalesPort;
  getSalesReconciliation: GetSalesReconciliationPort;
  getDreParameters: GetDreParametersPort;
  saveDreParameters: SaveDreParametersPort;
}

/** Composition root: liga o adapter HTTP aos casos de uso. */
function buildModule(): CashFlowModule {
  const api = new HttpCashFlowApiAdapter();
  return {
    getCashFlow: new GetCashFlowUseCase(api),
    getToHandle: new GetCashFlowToHandleUseCase(api),
    getDre: new GetDreUseCase(api),
    getDreRestaurantSales: new GetDreRestaurantSalesUseCase(api),
    getSalesReconciliation: new GetSalesReconciliationUseCase(api),
    getDreParameters: new GetDreParametersUseCase(api),
    saveDreParameters: new SaveDreParametersUseCase(api),
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
