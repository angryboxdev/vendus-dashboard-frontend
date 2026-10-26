import type { StockDemoScenario } from "../entities/stock-demo.ts";

export const STOCK_DEMO_HEADER = "X-Stock-Demo";

/** O modo Demonstração só vale nas páginas da Gestão de Stock (o resto da aplicação mostra sempre a empresa real). */
export function isStockPage(pagePath: string): boolean {
  return pagePath === "/stock" || pagePath.startsWith("/stock/");
}

/**
 * Cabeçalho a juntar a um pedido: só com um cenário ativo, numa página do Stock e para a API. O backend troca de
 * organização apenas nas rotas do Stock; fora delas ignora-o.
 */
export function stockDemoHeaders(apiPath: string, pagePath: string, scenario: StockDemoScenario | null): Record<string, string> {
  if (!scenario || !isStockPage(pagePath)) return {};
  if (!(apiPath.startsWith("/api/") || apiPath.includes("/api/"))) return {};
  return { [STOCK_DEMO_HEADER]: scenario };
}
