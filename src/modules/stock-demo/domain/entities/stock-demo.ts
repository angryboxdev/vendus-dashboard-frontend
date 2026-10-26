/** Demonstração do Stock: cenários fictícios (independente da demonstração do RH). */
export type StockDemoScenario = "brasileira" | "hamburgueria" | "bar";
export const STOCK_DEMO_SCENARIOS: StockDemoScenario[] = ["brasileira", "hamburgueria", "bar"];
export const STOCK_DEMO_LABELS: Record<StockDemoScenario, string> = {
  brasileira: "Comida brasileira",
  hamburgueria: "Hamburgueria",
  bar: "Bar",
};

export function isStockDemoScenario(v: unknown): v is StockDemoScenario {
  return typeof v === "string" && (STOCK_DEMO_SCENARIOS as string[]).includes(v);
}

export interface StockDemoScenarioStatusDTO {
  scenario: StockDemoScenario;
  label: string;
  created: boolean;
  posName: string | null;
  posApiKeyHint: string | null;
  monthlySalesTargetCents: number | null;
}

export interface StockDemoStatusDTO {
  scenarios: StockDemoScenarioStatusDTO[];
}

export interface StockDemoSeedResultDTO {
  scenario: StockDemoScenario;
  created: boolean;
  summary: { items: number; suppliers: number; invoices: number; dishes: number; preparations: number; salesCents30d: number; movements: number } | null;
  forecast: "ok" | "failed";
}
