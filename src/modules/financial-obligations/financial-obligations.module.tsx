import { createContext, useContext, type ReactNode } from "react";
import { HttpObligationsApiAdapter } from "./adapters/out/http-obligations-api.adapter.ts";
import type { ObligationsApiPort } from "./domain/ports/out/obligations-api.port.ts";

export interface FinancialObligationsModule {
  api: ObligationsApiPort;
}

function buildModule(): FinancialObligationsModule {
  return { api: new HttpObligationsApiAdapter() };
}

const FinancialObligationsContext = createContext<FinancialObligationsModule | null>(null);

export function FinancialObligationsProvider({
  children,
  module: mod,
}: {
  children: ReactNode;
  module?: FinancialObligationsModule;
}) {
  const value = mod ?? buildModule();
  return (
    <FinancialObligationsContext.Provider value={value}>
      {children}
    </FinancialObligationsContext.Provider>
  );
}

export function useFinancialObligationsModule(): FinancialObligationsModule {
  const ctx = useContext(FinancialObligationsContext);
  if (!ctx)
    throw new Error(
      "useFinancialObligationsModule must be used inside FinancialObligationsProvider",
    );
  return ctx;
}
