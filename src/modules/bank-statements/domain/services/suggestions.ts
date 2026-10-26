import type { MovementCandidateDTO } from "../entities/bank-statement.ts";

/** Abaixo disto não é sugestão (decisão do utilizador 2026-10-26; mesmo valor que o backend). */
export const SUGGESTION_MIN_CONFIDENCE = 0.9;

/**
 * Sugestão «forte»: o nome do fornecedor E o valor batem e a confiança é ≥ 90%. Só estas aparecem como
 * sugestão (separador «Sugestões» já vem filtrado do backend; aqui, as «Sugestões automáticas» do painel).
 * Os outros candidatos continuam acessíveis pela pesquisa manual.
 */
export function isStrongCandidate(c: Pick<MovementCandidateDTO, "confidence" | "nameMatched" | "amountMatched">): boolean {
  return c.confidence >= SUGGESTION_MIN_CONFIDENCE && c.nameMatched === true && c.amountMatched === true;
}
