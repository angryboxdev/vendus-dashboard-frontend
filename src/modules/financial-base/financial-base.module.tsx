import { createContext, useContext, type ReactNode } from "react";
import { HttpFinancialBaseApiAdapter } from "./adapters/out/http-financial-base-api.adapter.ts";
import type { FinancialBaseApiPort } from "./domain/ports/out/financial-base-api.port.ts";

export interface FinancialBaseModule {
  api: FinancialBaseApiPort;
}

function buildModule(): FinancialBaseModule {
  return { api: new HttpFinancialBaseApiAdapter() };
}

const FinancialBaseContext = createContext<FinancialBaseModule | null>(null);

export function FinancialBaseProvider({
  children,
  module: mod,
}: {
  children: ReactNode;
  module?: FinancialBaseModule;
}) {
  const value = mod ?? buildModule();
  return (
    <FinancialBaseContext.Provider value={value}>
      {children}
    </FinancialBaseContext.Provider>
  );
}

export function useFinancialBaseModule(): FinancialBaseModule {
  const ctx = useContext(FinancialBaseContext);
  if (!ctx) throw new Error("useFinancialBaseModule must be used inside FinancialBaseProvider");
  return ctx;
}
