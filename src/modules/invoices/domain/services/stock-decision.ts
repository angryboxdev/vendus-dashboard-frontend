import type { FinancialModeName, LineDetailMode, StockReviewOverride, StockRoutingSuggestion } from "../entities/invoice.ts";

/**
 * «Enviar para Stock» no lançamento (F2 v1.2 §2.1), espelho de
 * `resolveStockRouting` no backend. `choice` = escolha explícita da pessoa
 * (null = segue a sugestão → «auto», o servidor aplica a predefinição).
 * «Decidir no documento» exige escolha; desmarcar contra uma predefinição
 * «Enviar» exige motivo curto.
 */
export interface StockDecision {
  checked: boolean;
  override: StockReviewOverride;
  overrideReason: string | null;
  /** Desmarcado contra a predefinição «Enviar» → mostrar o campo de motivo. */
  contrary: boolean;
  /** O que impede lançar (null = nada). */
  blocking: string | null;
}

export function stockDecision(suggestion: StockRoutingSuggestion | null, choice: boolean | null, reason: string): StockDecision {
  const checked = choice ?? suggestion?.send === true;
  const contrary = choice === false && suggestion?.send === true;
  let blocking: string | null = null;
  if (choice === null && suggestion?.requiresDecision) blocking = "Indique se este documento é enviado para o Stock.";
  else if (contrary && !reason.trim()) blocking = "Indique o motivo para não enviar para o Stock.";
  return {
    checked,
    override: choice === null ? "auto" : choice ? "force_create" : "force_skip",
    overrideReason: choice === false ? reason.trim() || null : null,
    contrary,
    blocking,
  };
}

/** Escolha inicial a partir do que está gravado («auto» = ainda sem escolha). */
export function initialStockChoice(override: StockReviewOverride | null | undefined): boolean | null {
  return override === "force_create" ? true : override === "force_skip" ? false : null;
}

/**
 * Loja e subcategorias que o servidor usa para a sugestão (mesma regra de
 * `resolveStockRouting`): uma só loja nas linhas → essa; nenhuma → destino
 * habitual do fornecedor; várias → nenhuma.
 */
export function stockRoutingInput(
  lines: { locationId: string | null; categoryId: string | null }[],
  headerCategoryId: string | null,
  supplierDefaultLocationId: string | null,
): { locationId: string | null; categoryIds: string[] } {
  const locations = [...new Set(lines.map((l) => l.locationId).filter((l): l is string => !!l))];
  const locationId = locations.length === 1 ? locations[0]! : locations.length === 0 ? supplierDefaultLocationId : null;
  const categoryIds = [...new Set([...lines.map((l) => l.categoryId), headerCategoryId].filter((c): c is string => !!c))].sort();
  return { locationId, categoryIds };
}

/** «Única» | «Por artigo» | «Por valores» ↔ modo de linhas guardado. */
export const FINANCIAL_MODE_OF: Record<LineDetailMode, FinancialModeName> = {
  simple: "single",
  detailed: "by_item",
  by_values: "by_values",
};

export const LINE_DETAIL_MODE_OF: Record<FinancialModeName, LineDetailMode> = {
  single: "simple",
  by_item: "detailed",
  by_values: "by_values",
};
