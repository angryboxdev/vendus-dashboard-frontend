import type { ClassifyMovementPayload, MonthlyEntityMatchSuggestionDTO, MonthlyOccurrenceMatchSuggestionDTO, MovementCandidateDTO } from "../entities/bank-statement.ts";

/** Abaixo disto não é sugestão (decisão do utilizador 2026-10-26: «abaixo de 70% não interessa»; mesmo valor que o backend). */
export const SUGGESTION_MIN_CONFIDENCE = 0.7;

/**
 * Sugestão «forte»: o nome do fornecedor E o valor batem e a confiança é ≥ 70%. Só estas aparecem como
 * sugestão (separador «Sugestões» já vem filtrado do backend; aqui, as «Sugestões automáticas» do painel).
 * Os outros candidatos continuam acessíveis pela pesquisa manual.
 */
export function isStrongCandidate(c: Pick<MovementCandidateDTO, "confidence" | "nameMatched" | "amountMatched">): boolean {
  return c.confidence >= SUGGESTION_MIN_CONFIDENCE && c.nameMatched === true && c.amountMatched === true;
}

/** Um pedido de conciliação (o mesmo que o painel envia) para uma sugestão de fatura/conta a pagar. */
export interface BulkReconcileItem {
  movementId: string;
  amountCents: number;
  entityLinks: Array<{ entityType: "invoice" | "payable_entry"; entityId: string; allocatedAmountCents: number; supplierId: string | null }>;
}

/**
 * «Conciliar todas»: transforma as sugestões de faturas/contas a pagar nos pedidos de conciliação, como se
 * cada uma fosse confirmada no painel — o valor associado é o saldo em aberto do documento, limitado ao
 * valor do movimento. Sugestões cujo movimento não está no mês são ignoradas.
 */
export function bulkReconcileItems(
  suggestions: Pick<MonthlyEntityMatchSuggestionDTO, "movementId" | "entityType" | "entityId" | "openBalanceCents" | "supplierId">[],
  movementAmounts: ReadonlyMap<string, number>,
): BulkReconcileItem[] {
  return suggestions.flatMap((s) => {
    const amount = movementAmounts.get(s.movementId);
    if (amount === undefined) return [];
    return [{
      movementId: s.movementId,
      amountCents: amount,
      entityLinks: [{ entityType: s.entityType, entityId: s.entityId, allocatedAmountCents: Math.min(s.openBalanceCents, amount), supplierId: s.supplierId }],
    }];
  });
}

/**
 * Classificação a enviar para uma sugestão de recorrência (como no painel «Justificar despesa → Contrato /
 * Recorrência»): liga o movimento à ocorrência — o backend deixa-a paga — e herda a categoria da recorrência.
 */
export function occurrenceClassification(s: MonthlyOccurrenceMatchSuggestionDTO): ClassifyMovementPayload {
  return {
    justificationType: "contrato_recorrencia",
    matchedEntityType: "recurrence_occurrence",
    matchedEntityId: s.occurrenceId,
    ...(s.costCenterGroupId && { costCenterGroupId: s.costCenterGroupId }),
    ...(s.costCenterCategoryId && { costCenterCategoryId: s.costCenterCategoryId }),
    ...(s.supplierId && { supplierId: s.supplierId }),
    ...(s.vatRate != null && { vatRate: s.vatRate, vatIncluded: s.vatIncluded ?? true }),
  };
}
