import { createContext, useContext, type ReactNode } from "react";
import { HttpInvoicesApiAdapter } from "./adapters/out/http-invoices-api.adapter.ts";
import type { InvoicesApiPort } from "./domain/ports/out/invoices-api.port.ts";

export interface InvoicesModule {
  api: InvoicesApiPort;
}

function buildModule(): InvoicesModule {
  return { api: new HttpInvoicesApiAdapter() };
}

const InvoicesContext = createContext<InvoicesModule | null>(null);

export function InvoicesProvider({
  children,
  module: mod,
}: {
  children: ReactNode;
  module?: InvoicesModule;
}) {
  const value = mod ?? buildModule();
  return <InvoicesContext.Provider value={value}>{children}</InvoicesContext.Provider>;
}

export function useInvoicesModule(): InvoicesModule {
  const ctx = useContext(InvoicesContext);
  if (!ctx) throw new Error("useInvoicesModule must be used inside InvoicesProvider");
  return ctx;
}
