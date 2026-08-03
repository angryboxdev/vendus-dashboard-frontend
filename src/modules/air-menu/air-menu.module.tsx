import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { HttpAirMenuApiAdapter } from "./adapters/out/http-air-menu-api.adapter.ts";
import { GetEnterprisesUseCase } from "./application/use-cases/get-enterprises.use-case.ts";
import { GetSummaryUseCase } from "./application/use-cases/get-summary.use-case.ts";
import { GetOrderRawUseCase } from "./application/use-cases/get-order-raw.use-case.ts";
import type { GetEnterprisesPort } from "./domain/ports/in/get-enterprises.port.ts";
import type { GetSummaryPort } from "./domain/ports/in/get-summary.port.ts";
import type { GetOrderRawPort } from "./domain/ports/in/get-order-raw.port.ts";

export interface AirMenuModule {
  getEnterprises: GetEnterprisesPort;
  getSummary: GetSummaryPort;
  getOrderRaw: GetOrderRawPort;
}

const AirMenuContext = createContext<AirMenuModule | null>(null);

export function AirMenuProvider({
  children,
  module: mod,
}: {
  children: ReactNode;
  module?: AirMenuModule;
}) {
  const module = useMemo<AirMenuModule>(() => {
    if (mod) return mod;
    const api = new HttpAirMenuApiAdapter();
    return {
      getEnterprises: new GetEnterprisesUseCase(api),
      getSummary: new GetSummaryUseCase(api),
      getOrderRaw: new GetOrderRawUseCase(api),
    };
  }, [mod]);

  return (
    <AirMenuContext.Provider value={module}>{children}</AirMenuContext.Provider>
  );
}

export function useAirMenuModule(): AirMenuModule {
  const ctx = useContext(AirMenuContext);
  if (!ctx)
    throw new Error("useAirMenuModule must be used inside AirMenuProvider");
  return ctx;
}
