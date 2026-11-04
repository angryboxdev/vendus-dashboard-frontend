import { createContext, useContext, useState, type ReactNode } from "react";
import { CryptoIdGenerator, HttpInvoicingApiAdapter } from "./adapters/out/http-invoicing-api.adapter.ts";
import { InvoicingUseCases } from "./application/use-cases/invoicing.use-cases.ts";
import type { InvoicingPort } from "./domain/ports/in/invoicing.port.ts";

export interface InvoicingModule {
  invoicing: InvoicingPort;
}

/** Composition root: único sítio que conhece os adapters concretos. */
function buildModule(): InvoicingModule {
  return { invoicing: new InvoicingUseCases(new HttpInvoicingApiAdapter(), new CryptoIdGenerator()) };
}

const InvoicingContext = createContext<InvoicingModule | null>(null);

export function InvoicingProvider({ children, module: mod }: { children: ReactNode; module?: InvoicingModule }) {
  // Uma instância por montagem: os hooks dependem dela (uma nova por render recarregaria em ciclo).
  const [built] = useState(() => mod ?? buildModule());
  return <InvoicingContext.Provider value={built}>{children}</InvoicingContext.Provider>;
}

export function useInvoicingModule(): InvoicingModule {
  const ctx = useContext(InvoicingContext);
  if (!ctx) throw new Error("useInvoicingModule must be used inside InvoicingProvider");
  return ctx;
}
