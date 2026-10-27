import type {
  BankMovementDTO,
  ClassifyMovementPayload,
  CreateRulePayload,
  JustificationType,
} from "../entities/bank-statement.ts";

/**
 * «Movimentos recorrentes» — regras de conciliação automática criadas a partir de um movimento
 * classificado (taxas TPA, despesas bancárias e outros movimentos sem fatura que se repetem).
 * O backend reconhece pela descrição sem palavras com dígitos, com valor opcional, só nesta conta.
 */

/**
 * Justificações que podem virar regra. Ficam de fora «fatura» (precisa do documento de cada mês),
 * «sem justificativa» (não concilia) e «contrato/recorrência» (liga à ocorrência de um mês concreto).
 */
const RECURRING_JUSTIFICATIONS: ReadonlySet<JustificationType> = new Set([
  "recibo_comprovativo",
  "despesa_bancaria_automatica",
  "transferencia_interna",
  "emprestimo_financiamento",
]);

export function canBeRecurring(justificationType: JustificationType): boolean {
  return RECURRING_JUSTIFICATIONS.has(justificationType);
}

/** Escolhas do utilizador no painel («Classificar sempre assim»). */
export interface RecurringRuleDraft {
  name: string;
  /** true = só com este valor (± 1 €); false = qualquer valor (ex.: taxas que variam). */
  fixedAmount: boolean;
  /** Aplica já aos movimentos por classificar desta conta nos meses importados. */
  applyToExisting: boolean;
  /** «Contrato / Recorrência»: a recorrência (sem fatura) que cada pagamento futuro paga. */
  recurrenceId?: string | null;
}

/** Nome sugerido: a descrição legível (F4) quando existe, senão a do banco. */
export function suggestedRuleName(movement: Pick<BankMovementDTO, "description" | "normalizedDescription">): string {
  return (movement.normalizedDescription || movement.description).trim().slice(0, 120);
}

// Mesmas regras que o backend (`recurringMatchText`): só para mostrar o que a regra vai reconhecer.
const BANK_NOISE_WORDS = new Set([
  "transf", "transferencia", "cred", "credito", "deb", "debito", "pagamento", "pag", "ref", "ord", "bene", "orig",
  "sepa", "sibs", "iban", "liq", "liquidacao", "dev", "devolucao", "aut", "autorizacao", "oper", "operacao", "doc",
  "num", "way",
]);

/** Texto que a regra procura: descrição normalizada, sem termos bancários genéricos nem palavras com dígitos. */
export function recurringMatchPreview(description: string): string {
  return description
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !BANK_NOISE_WORDS.has(t) && !/\d/.test(t))
    .join(" ");
}

/** Pedido de criação da regra a partir do movimento e da classificação que acabou de ser gravada. */
export function buildRecurringRulePayload(
  movement: Pick<BankMovementDTO, "description" | "normalizedDescription" | "movementType" | "amount">,
  bankAccountId: string,
  classification: ClassifyMovementPayload,
  draft: RecurringRuleDraft,
): CreateRulePayload {
  return {
    name: draft.name.trim() || suggestedRuleName(movement),
    descriptionContains: movement.description,
    movementType: movement.movementType,
    bankAccountId,
    justificationType: draft.recurrenceId ? "contrato_recorrencia" : classification.justificationType,
    ...(draft.recurrenceId && { recurrenceId: draft.recurrenceId }),
    amountCents: draft.fixedAmount ? movement.amount : null,
    costCenterGroupId: classification.costCenterGroupId ?? null,
    costCenterCategoryId: classification.costCenterCategoryId ?? null,
    supplierId: classification.supplierId ?? null,
    vatRate: classification.vatRate ?? null,
    vatIncluded: classification.vatIncluded ?? null,
    applyToExisting: draft.applyToExisting,
  };
}
