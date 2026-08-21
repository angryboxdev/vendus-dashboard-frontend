import { createContext, useContext, type ReactNode } from "react";
import { HttpRecurrencesApiAdapter } from "./adapters/out/http-recurrences-api.adapter.ts";
import type { RecurrencesApiPort } from "./domain/ports/out/recurrences-api.port.ts";

export interface PayableRecurrencesModule {
  api: RecurrencesApiPort;
}

function buildModule(): PayableRecurrencesModule {
  return { api: new HttpRecurrencesApiAdapter() };
}

const PayableRecurrencesContext = createContext<PayableRecurrencesModule | null>(null);

export function PayableRecurrencesProvider({
  children,
  module: mod,
}: {
  children: ReactNode;
  module?: PayableRecurrencesModule;
}) {
  const value = mod ?? buildModule();
  return (
    <PayableRecurrencesContext.Provider value={value}>
      {children}
    </PayableRecurrencesContext.Provider>
  );
}

export function usePayableRecurrencesModule(): PayableRecurrencesModule {
  const ctx = useContext(PayableRecurrencesContext);
  if (!ctx)
    throw new Error(
      "usePayableRecurrencesModule must be used inside PayableRecurrencesProvider",
    );
  return ctx;
}
