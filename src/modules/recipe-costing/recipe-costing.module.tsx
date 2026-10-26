import { createContext, useContext, useMemo, type ReactNode } from "react";
import { HttpRecipeCostingApiAdapter } from "./adapters/out/http-recipe-costing-api.adapter.ts";
import type { RecipeCostingApiPort } from "./domain/ports/out/recipe-costing-api.port.ts";
import { HttpTechnicalSheetsApiAdapter } from "./adapters/out/http-technical-sheets-api.adapter.ts";
import type { TechnicalSheetsApiPort } from "./domain/ports/out/technical-sheets-api.port.ts";

export interface RecipeCostingModule {
  api: RecipeCostingApiPort;
  /** Pratos, receitas e preparações (Fichas técnicas V7); opcional nos testes que só leem custos. */
  sheets?: TechnicalSheetsApiPort;
}

function buildModule(): RecipeCostingModule {
  return { api: new HttpRecipeCostingApiAdapter(), sheets: new HttpTechnicalSheetsApiAdapter() };
}

const RecipeCostingContext = createContext<RecipeCostingModule | null>(null);

export function RecipeCostingProvider({
  children,
  module: mod,
}: {
  children: ReactNode;
  module?: RecipeCostingModule;
}) {
  const value = useMemo(() => mod ?? buildModule(), [mod]);
  return <RecipeCostingContext.Provider value={value}>{children}</RecipeCostingContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useRecipeCostingModule(): RecipeCostingModule {
  const ctx = useContext(RecipeCostingContext);
  if (!ctx) throw new Error("useRecipeCostingModule must be used inside RecipeCostingProvider");
  return ctx;
}
