import { createContext, useContext, type ReactNode } from "react";
import { HttpBankAccountsApiAdapter } from "./adapters/out/http-bank-accounts-api.adapter.ts";
import type { BankAccountsApiPort } from "./domain/ports/out/bank-accounts-api.port.ts";

export interface BankAccountsModule {
  api: BankAccountsApiPort;
}

function buildModule(): BankAccountsModule {
  return { api: new HttpBankAccountsApiAdapter() };
}

const BankAccountsContext = createContext<BankAccountsModule | null>(null);

export function BankAccountsProvider({
  children,
  module: mod,
}: {
  children: ReactNode;
  module?: BankAccountsModule;
}) {
  const value = mod ?? buildModule();
  return (
    <BankAccountsContext.Provider value={value}>
      {children}
    </BankAccountsContext.Provider>
  );
}

export function useBankAccountsModule(): BankAccountsModule {
  const ctx = useContext(BankAccountsContext);
  if (!ctx)
    throw new Error("useBankAccountsModule must be used inside BankAccountsProvider");
  return ctx;
}
