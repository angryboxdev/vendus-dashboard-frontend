import { createContext, useContext, type ReactNode } from "react";
import { HttpBankStatementsApiAdapter } from "./adapters/out/http-bank-statements-api.adapter.ts";
import type { BankStatementsApiPort } from "./domain/ports/out/bank-statements-api.port.ts";

export interface BankStatementsModule {
  api: BankStatementsApiPort;
}

function buildModule(): BankStatementsModule {
  return { api: new HttpBankStatementsApiAdapter() };
}

const BankStatementsContext = createContext<BankStatementsModule | null>(null);

export function BankStatementsProvider({
  children,
  module: mod,
}: {
  children: ReactNode;
  module?: BankStatementsModule;
}) {
  const value = mod ?? buildModule();
  return (
    <BankStatementsContext.Provider value={value}>
      {children}
    </BankStatementsContext.Provider>
  );
}

export function useBankStatementsModule(): BankStatementsModule {
  const ctx = useContext(BankStatementsContext);
  if (!ctx)
    throw new Error("useBankStatementsModule must be used inside BankStatementsProvider");
  return ctx;
}
