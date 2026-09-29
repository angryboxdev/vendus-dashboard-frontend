import { createContext, useContext, type ReactNode } from "react";
import { HttpAccountingApiAdapter } from "./adapters/out/http-accounting-api.adapter.ts";
import type { AccountingApiPort } from "./domain/ports/out/accounting-api.port.ts";

export interface AccountingModule {
  api: AccountingApiPort;
}

function buildModule(): AccountingModule {
  return { api: new HttpAccountingApiAdapter() };
}

const AccountingContext = createContext<AccountingModule | null>(null);

export function AccountingProvider({ children, module: mod }: { children: ReactNode; module?: AccountingModule }) {
  const value = mod ?? buildModule();
  return <AccountingContext.Provider value={value}>{children}</AccountingContext.Provider>;
}

export function useAccountingModule(): AccountingModule {
  const ctx = useContext(AccountingContext);
  if (!ctx) throw new Error("useAccountingModule must be used inside AccountingProvider");
  return ctx;
}
