import { createContext, useContext, type ReactNode } from "react";
import { HttpPayableEntriesApiAdapter } from "./adapters/out/http-payable-entries-api.adapter.ts";
import type { PayableEntriesApiPort } from "./domain/ports/out/payable-entries-api.port.ts";

export interface PayableEntriesModule {
  api: PayableEntriesApiPort;
}

function buildModule(): PayableEntriesModule {
  return { api: new HttpPayableEntriesApiAdapter() };
}

const PayableEntriesContext = createContext<PayableEntriesModule | null>(null);

export function PayableEntriesProvider({
  children,
  module: mod,
}: {
  children: ReactNode;
  module?: PayableEntriesModule;
}) {
  const value = mod ?? buildModule();
  return (
    <PayableEntriesContext.Provider value={value}>
      {children}
    </PayableEntriesContext.Provider>
  );
}

export function usePayableEntriesModule(): PayableEntriesModule {
  const ctx = useContext(PayableEntriesContext);
  if (!ctx) throw new Error("usePayableEntriesModule must be used inside PayableEntriesProvider");
  return ctx;
}
