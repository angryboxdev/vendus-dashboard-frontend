import type { StockDemoScenario, StockDemoSeedResultDTO, StockDemoStatusDTO } from "../../entities/stock-demo.ts";

/** Demonstração do Stock no backend (`/api/stock-demo`), sempre na empresa real. */
export interface StockDemoApiPort {
  getStatus(): Promise<StockDemoStatusDTO>;
  create(scenario: StockDemoScenario): Promise<StockDemoSeedResultDTO>;
  reset(scenario: StockDemoScenario): Promise<StockDemoSeedResultDTO>;
}

/** Cenário ativo neste navegador (preferência do utilizador; não é estado partilhado). */
export interface StockDemoModeStorePort {
  get(): StockDemoScenario | null;
  set(scenario: StockDemoScenario | null): void;
}
