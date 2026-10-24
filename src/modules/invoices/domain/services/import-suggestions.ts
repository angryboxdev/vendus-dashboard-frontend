import type { AiExtractedLineDTO, LineDetailMode, LineReadingMeta } from "../entities/invoice.ts";

/**
 * Sugestões do leitor inteligente (E3) na revisão de uma importação — sempre
 * sugestões: a pessoa confirma ou muda antes de guardar.
 */

const suggested = (lines: AiExtractedLineDTO[]) => lines.map((l) => l.suggestedCostCenterCategoryId ?? null);

/** Linhas com subcategorias sugeridas diferentes → «Por artigo»; sem sugestões → sem opinião. */
export function suggestedDetailMode(lines: AiExtractedLineDTO[]): LineDetailMode | null {
  const ids = new Set(suggested(lines).filter((id): id is string => !!id));
  return ids.size > 1 ? "detailed" : null;
}

/** Todas as linhas com a mesma subcategoria sugerida → serve de categoria única da fatura. */
export function singleSuggestedCategory(lines: AiExtractedLineDTO[]): string | null {
  const ids = suggested(lines);
  if (!ids.length || ids.some((id) => !id)) return null;
  return new Set(ids).size === 1 ? ids[0]! : null;
}

/** Metadados a guardar com a linha: a origem passa a «manual» se a pessoa mudou a sugestão. */
export function readingForPayload(reading: LineReadingMeta | undefined, suggestedCatId: string | null, chosenCatId: string): LineReadingMeta | undefined {
  if (!reading) return undefined;
  if ((chosenCatId || null) === suggestedCatId) return reading;
  return { ...reading, classificationSource: "manual", classificationEvidence: null };
}
