import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { HttpVendusApiAdapter } from "./adapters/out/http-vendus-api.adapter.ts";
import { GetSummaryUseCase } from "./application/use-cases/get-summary.use-case.ts";
import { GetSelfConsumptionUseCase } from "./application/use-cases/get-selfconsumption.use-case.ts";
import type { GetSummaryPort } from "./domain/ports/in/get-summary.port.ts";
import type { GetSelfConsumptionPort } from "./domain/ports/in/get-selfconsumption.port.ts";

export interface VendusModule {
  getSummary: GetSummaryPort;
  getSelfConsumption: GetSelfConsumptionPort;
}

const VendusContext = createContext<VendusModule | null>(null);

export function VendusProvider({
  children,
  module: mod,
}: {
  children: ReactNode;
  module?: VendusModule;
}) {
  const module = useMemo<VendusModule>(() => {
    if (mod) return mod;
    const api = new HttpVendusApiAdapter();
    return {
      getSummary: new GetSummaryUseCase(api),
      getSelfConsumption: new GetSelfConsumptionUseCase(api),
    };
  }, [mod]);

  return (
    <VendusContext.Provider value={module}>{children}</VendusContext.Provider>
  );
}

export function useVendusModule(): VendusModule {
  const ctx = useContext(VendusContext);
  if (!ctx)
    throw new Error("useVendusModule must be used inside VendusProvider");
  return ctx;
}
