export type ReconciliationStatus =
  | "conciliado_com_fatura"
  | "conciliado_parcial"
  | "conciliado_sem_fatura"
  | "justificado"
  | "sugestao"
  | "pendente_de_documento"
  | "saida_nao_justificada"
  | "transferencia_interna"
  | "divergente"
  | "ignorado_com_motivo";

export type JustificationType =
  | "fatura"
  | "recibo_comprovativo"
  | "contrato_recorrencia"
  | "despesa_bancaria_automatica"
  | "transferencia_interna"
  | "emprestimo_financiamento"
  | "sem_justificativa";

export type RiskLevel = "low" | "medium" | "high" | "critical";
export type MovementType = "debit" | "credit";
export type StatementStatus = "draft" | "in_review" | "completed" | "closed";
export type StatementSourceType = "csv" | "xlsx" | "manual" | "pdf";
export type MatchedEntityType =
  | "invoice"
  | "payable_entry"
  | "recurrence_occurrence"
  | "receipt"
  | "internal_transfer"
  | "manual_entry";

// ── Labels ────────────────────────────────────────────────────────────────────

export const RECONCILIATION_STATUS_LABELS: Record<ReconciliationStatus, string> = {
  conciliado_com_fatura: "Conciliado c/ Fatura",
  conciliado_parcial: "Conciliação Parcial",
  conciliado_sem_fatura: "Conciliado s/ Fatura",
  justificado: "Justificado",
  sugestao: "Sugestão",
  pendente_de_documento: "Pendente de Documento",
  saida_nao_justificada: "Saída Não Justificada",
  transferencia_interna: "Transferência Interna",
  divergente: "Divergente",
  ignorado_com_motivo: "Ignorado",
};

export const JUSTIFICATION_TYPE_LABELS: Record<JustificationType, string> = {
  fatura: "Fatura",
  recibo_comprovativo: "Recibo / Comprovativo",
  contrato_recorrencia: "Contrato / Recorrência",
  despesa_bancaria_automatica: "Despesa Bancária Automática",
  transferencia_interna: "Transferência Interna",
  emprestimo_financiamento: "Empréstimo / Financiamento",
  sem_justificativa: "Sem Justificativa",
};

export const RISK_LEVEL_LABELS: Record<RiskLevel, string> = {
  low: "Baixo",
  medium: "Médio",
  high: "Alto",
  critical: "Crítico",
};

export const STATEMENT_STATUS_LABELS: Record<StatementStatus, string> = {
  draft: "Rascunho",
  in_review: "Em Revisão",
  completed: "Concluído",
  closed: "Fechado",
};

/** States that count as resolved in progress calculation. */
export const RESOLVED_STATUSES: ReadonlySet<ReconciliationStatus> = new Set([
  "conciliado_com_fatura",
  "conciliado_sem_fatura",
  "justificado",
  "transferencia_interna",
  "ignorado_com_motivo",
]);

// ── DTOs ──────────────────────────────────────────────────────────────────────

export interface EntityLinkDTO {
  id: string;
  entityType: "invoice" | "payable_entry";
  entityId: string;
  amountCents: number;           // entity's total at time of reconciliation
  allocatedAmountCents: number;  // portion of movement allocated to this entity
  entityLabel: string;
}

export interface BankStatementSummaryDTO {
  id: string;
  bankAccountId: string | null;
  bankName: string;
  accountNumber: string;
  periodStart: string; // ISO date
  periodEnd: string;   // ISO date
  currency: string;
  sourceType: StatementSourceType;
  importedMovementsCount: number;
  openingBalance: number;            // cents
  closingBalance: number;            // cents
  calculatedClosingBalance: number;  // cents
  balanceDifference: number;         // cents
  reconciliationProgress: number;    // 0–100
  status: StatementStatus;
  createdAt: string;
}

/** Tipo do movimento (V2 F4): natureza para ler e filtrar — não confundir com débito/crédito. */
export type MovementKind =
  | "sales"
  | "deposit"
  | "transfer_in"
  | "transfer_out"
  | "supplier"
  | "payroll"
  | "tax_state"
  | "bank_fee"
  | "insurance"
  | "utilities"
  | "card_purchase"
  | "internal_transfer"
  | "reversal"
  | "to_review";

export interface BankMovementDTO {
  id: string;
  bookingDate: string;    // ISO date
  valueDate: string;      // ISO date
  description: string;
  /** V2 (F4) — opcionais: um backend anterior não os envia. */
  normalizedDescription?: string;
  movementKind?: MovementKind;
  amount: number;         // cents, absolute
  balanceAfter: number;   // cents
  currency: string;
  movementType: MovementType;
  reconciliationStatus: ReconciliationStatus;
  justificationType: JustificationType | null;
  riskLevel: RiskLevel;
  requiresDocument: boolean;
  documentUrl: string | null;
  matchedEntityType: MatchedEntityType | null;
  matchedEntityId: string | null;
  confidenceScore: number | null;
  notes: string | null;
  isResolved: boolean;
  costCenterGroupId: string | null;
  costCenterCategoryId: string | null;
  supplierId: string | null;
  vatRate: number | null;
  vatIncluded: boolean | null;
  entityLinks: EntityLinkDTO[];
  reconciliationAmountDiff: number | null;
  /** Regra («movimento recorrente») que o conciliou automaticamente; null = manual/nenhuma. Opcional até o backend novo estar em produção. */
  classifiedByRuleId?: string | null;
}

export interface BankStatementDetailDTO extends BankStatementSummaryDTO {
  sourceFileName: string | null;
  movements: BankMovementDTO[];
  statusCounts: Partial<Record<ReconciliationStatus, number>>;
}

/** V2 (F3): para que conta foi (ou vai) o extrato quando o banco/conta vêm do próprio extrato. */
export interface StatementAccountResolutionDTO {
  status: "existing" | "created" | "to_create";
  bankId: string | null;
  bankName: string;
  bankIsNew: boolean;
  accountId: string | null;
  accountName: string;
}

export interface ImportStatementResult {
  id: string;
  accountResolution?: StatementAccountResolutionDTO | null;
  bankAccountId: string | null;
  accountMatched: boolean;
  parsedAccountNumber: string;
  bankName: string;
  accountNumber: string;
  importedMovementsCount: number;
  skippedDuplicates: number;
  calculatedClosingBalance: number;
  balanceDifference: number;
  reconciliationProgress: number;
  status: StatementStatus;
}

export interface ApplyRulesResult {
  statementImportId: string;
  appliedCount: number;
  reconciliationProgress: number;
}

export interface MatchSuggestionDTO {
  movementId: string;
  entityType: MatchedEntityType;
  entityId: string;
  entityLabel: string;
  confidence: number;
}

/**
 * «Movimento recorrente»: regra de conciliação automática (taxas TPA, despesas bancárias…).
 * Reconhece pela descrição (sem palavras com dígitos), com valor fixo opcional, só na conta de origem.
 */
export interface ReconciliationRuleDTO {
  id: string;
  name: string;
  descriptionContains: string;
  movementType: MovementType | null;
  /** null = todas as contas (regras antigas). */
  bankAccountId: string | null;
  /** null = qualquer valor. */
  amountCents: number | null;
  amountToleranceCents: number;
  costCenterGroupId: string | null;
  costCenterCategoryId: string | null;
  supplierId: string | null;
  vatRate: number | null;
  vatIncluded: boolean | null;
  justificationType: JustificationType;
  requiresDocument: boolean;
  riskLevel: RiskLevel;
  isActive: boolean;
  createdAt: string;
  /** Só na listagem: movimentos conciliados pela regra e data do último. */
  usage?: { movementsCount: number; lastBookingDate: string | null };
}

/** Criar/alterar uma regra devolve também quantos movimentos já importados ficaram conciliados. */
export interface ReconciliationRuleWriteResultDTO extends ReconciliationRuleDTO {
  appliedCount: number;
}

export interface OccurrenceCandidateDTO {
  id: string;
  recurrenceId: string;
  recurrenceName: string;
  supplierId: string | null;
  supplierName: string;
  period: string;              // YYYY-MM
  effectiveAmountCents: number;
  dueDate: string;             // YYYY-MM-DD
  status: string;
  /** Classificação da recorrência-mãe — usada para auto-preencher o drawer (só campos ainda vazios). */
  costCenterGroupId: string | null;
  costCenterCategoryId: string | null;
  vatRate: number | null;
  vatIncluded: boolean | null;
}

// ── Payloads ──────────────────────────────────────────────────────────────────

export interface ImportStatementPayload {
  bankName: string;
  accountNumber: string;
  openingBalance: number;  // cents
  closingBalance: number;  // cents
  periodStart?: string;    // YYYY-MM-DD
  periodEnd?: string;      // YYYY-MM-DD
  currency?: string;
}

export interface ClassifyMovementPayload {
  justificationType: JustificationType;
  matchedEntityType?: MatchedEntityType;
  matchedEntityId?: string;
  riskLevel?: RiskLevel;
  notes?: string;
  documentUrl?: string;
  costCenterGroupId?: string;
  costCenterCategoryId?: string;
  supplierId?: string;
  vatRate?: number;
  vatIncluded?: boolean;
}

export interface MovementCandidateDTO {
  entityType: "invoice" | "payable_entry";
  entityId: string;
  entityLabel: string;
  supplierId: string | null;
  amountCents: number;       // entity's full amount
  openBalanceCents: number;  // unpaid balance
  date: string;
  confidence: number;
  /** Fornecedor aprendido ou nome do fornecedor na descrição (backend). */
  nameMatched?: boolean;
  /** Total ou saldo em aberto a ≤ 1 € do movimento (backend). */
  amountMatched?: boolean;
}

// ── Account calendar ──────────────────────────────────────────────────────────

/** Estado do mês: extrato e conciliação são independentes; sem extrato nunca há percentagem. */
export type MonthStatus = "no_statement" | "imported" | "partial" | "reconciled";

export interface AccountMonthStatDTO {
  year: number;
  month: number; // 1–12
  statementImported: boolean;
  status: MonthStatus;
  totalMovements: number;
  /** Movimentos que contam para a conciliação (sem os créditos aceites automaticamente na importação). */
  reconcilableMovements: number;
  reconciledMovements: number;
  /** `null` sem extrato ou sem movimentos. */
  reconciledPercent: number | null;
  inflowCents: number;
  outflowCents: number;
  netCents: number;
  openingBalanceCents: number | null;
  closingBalanceCents: number | null;
  /** @deprecated use `reconciledPercent`. */
  salesReconciledPercent: number;
  /** @deprecated use `reconciledPercent`. */
  expensesReconciledPercent: number;
  /** @deprecated = `inflowCents`. */
  totalCreditCents: number;
  /** @deprecated = `outflowCents`. */
  totalDebitCents: number;
  /** @deprecated = `netCents`. */
  balanceCents: number;
}

export interface DaySlotDTO {
  date: string; // YYYY-MM-DD
  movements: BankMovementDTO[];
  totalDebitCents: number;
  totalCreditCents: number;
  totalMovements: number;
  reconciledCount: number;
}

export interface MonthlyEntityMatchSuggestionDTO {
  movementId: string;
  entityType: "invoice" | "payable_entry";
  entityId: string;
  entityLabel: string;
  amountCents: number;
  openBalanceCents: number;
  supplierId: string | null;
  confidence: number;
}

export interface RepeatJustificationSuggestionDTO {
  movementId: string;
  sourceMovementId: string;
  sourceDescription: string;
  sourceDate: string; // YYYY-MM-DD
  justificationType: JustificationType;
  costCenterGroupId: string | null;
  costCenterCategoryId: string | null;
  supplierId: string | null;
  notes: string | null;
  riskLevel: RiskLevel;
  vatRate: number | null;
  vatIncluded: boolean | null;
}

export interface MonthlySuggestionsDTO {
  entityMatches: MonthlyEntityMatchSuggestionDTO[];
  repeatJustifications: RepeatJustificationSuggestionDTO[];
}

export interface InvoiceLinkedMovementDTO {
  movementId: string;
  bookingDate: string;          // YYYY-MM-DD
  description: string;
  allocatedAmountCents: number; // portion of the movement allocated to this invoice
  movementType: MovementType;
}

export interface CreateRulePayload {
  name: string;
  descriptionContains: string;
  movementType?: MovementType | null;
  justificationType: JustificationType;
  requiresDocument?: boolean;
  riskLevel?: RiskLevel;
  bankAccountId?: string | null;
  amountCents?: number | null;
  amountToleranceCents?: number;
  costCenterGroupId?: string | null;
  costCenterCategoryId?: string | null;
  supplierId?: string | null;
  vatRate?: number | null;
  vatIncluded?: boolean | null;
  /** Aplica já aos movimentos por classificar desta conta nos meses importados. */
  applyToExisting?: boolean;
}

export interface UpdateRulePayload {
  name?: string;
  descriptionContains?: string;
  amountCents?: number | null;
  amountToleranceCents?: number;
  costCenterGroupId?: string | null;
  costCenterCategoryId?: string | null;
  supplierId?: string | null;
  vatRate?: number | null;
  vatIncluded?: boolean | null;
  justificationType?: JustificationType;
  isActive?: boolean;
  applyToExisting?: boolean;
}

// ── Grouped settlement ("Liquidação agrupada") ─────────────────────────────────

/**
 * Document type as seen from the bank-statements module — deliberately not
 * imported from `invoices`' own `InvoiceDocumentType` to keep this module's
 * domain self-contained (same literal values, `invoice` | `credit_note`).
 */
export type GroupedSettlementDocumentType = "invoice" | "credit_note";

export interface GroupedSettlementDocDTO {
  entityId: string;
  documentType: GroupedSettlementDocumentType;
  entityLabel: string;
  supplierId: string | null;
  /** Signed: positive for an invoice, negative for a credit note. */
  openBalanceCents: number;
  invoiceDate: string; // YYYY-MM-DD
  dueDate: string | null;
  isOverdue: boolean;
  isBeforeMovementDate: boolean;
}

export interface GroupedSettlementCombinationDTO {
  docs: GroupedSettlementDocDTO[];
  documentCount: number;
  invoiceCount: number;
  creditNoteCount: number;
  invoiceTotalCents: number;
  creditNoteTotalCents: number; // ≤ 0
  netTotalCents: number; // always equals the movement amount here
  isExactMatch: true;
}

export interface GetGroupedSettlementSuggestionsResult {
  movementId: string;
  movementAmountCents: number;
  currency: string;
  supplierId: string | null;
  supplierName: string | null;
  /** Present only when a plain 1:1 match exists — the existing single-suggestion UI already handles this case. */
  singleExactMatch: MovementCandidateDTO | null;
  /** The "Liquidação agrupada encontrada" card — null when `singleExactMatch` is present, or when no exact combination was found. */
  primaryCombination: GroupedSettlementCombinationDTO | null;
  /** Non-empty ⇒ show the "Encontrámos N liquidações possíveis" picker instead of the single suggestion card. */
  alternateCombinations: GroupedSettlementCombinationDTO[];
  /** Full pool for manual multi-select search — already excludes fully-settled documents and is same-supplier/same-currency/open/compatible-type/on-or-before-movement-date filtered. */
  eligibleDocuments: GroupedSettlementDocDTO[];
  totalEligibleBeforeCap: number;
  candidatePoolCap: number;
}

export interface GroupedEntityLinkInput {
  entityId: string;
  documentType: GroupedSettlementDocumentType;
  /** Signed, same as the `openBalanceCents` of the document being (fully) used. */
  allocatedAmountCents: number;
  /**
   * The `openBalanceCents` observed for this doc when the user built the
   * selection — sent back exactly as it came from `eligibleDocuments` /
   * the combination. The backend revalidates this and rejects (409) the
   * whole request if any one has changed.
   */
  expectedOpenBalanceCents: number;
}

export interface ConfirmGroupedSettlementResult {
  movementId: string;
  reconciliationStatus: ReconciliationStatus;
}

/** Shape of the 409 response body from `POST .../grouped-settlement`. */
export interface GroupedSettlementConflictDTO {
  error: string;
  entityIds: string[];
}
