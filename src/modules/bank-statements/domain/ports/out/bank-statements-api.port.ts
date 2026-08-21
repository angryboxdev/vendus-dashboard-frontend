import type {
  AccountMonthStatDTO,
  ApplyRulesResult,
  BankStatementDetailDTO,
  BankStatementSummaryDTO,
  ClassifyMovementPayload,
  CreateRulePayload,
  DaySlotDTO,
  ImportStatementResult,
  InvoiceLinkedMovementDTO,
  MatchSuggestionDTO,
  MovementCandidateDTO,
  MovementType,
  OccurrenceCandidateDTO,
  ReconciliationRuleDTO,
  ReconciliationStatus,
  RiskLevel,
  StatementStatus,
} from "../../entities/bank-statement.ts";

export interface ListStatementsParams {
  accountNumber?: string;
  status?: StatementStatus;
  from?: string;
  to?: string;
}

export interface GetStatementParams {
  reconciliationStatus?: ReconciliationStatus;
  movementType?: MovementType;
  riskLevel?: RiskLevel;
}

export interface StatementPreview {
  bankName: string | null;
  accountNumber: string | null;
  openingBalance: number | null;  // cents
  closingBalance: number | null;  // cents
  periodStart: string | null;     // YYYY-MM-DD
  periodEnd: string | null;       // YYYY-MM-DD
  movementsCount: number;
}

export interface BankStatementsApiPort {
  /** Parse file without saving — returns detected metadata. */
  previewStatement(file: File): Promise<StatementPreview>;

  /** Upload CSV/XLSX file + metadata. */
  importStatement(formData: FormData): Promise<ImportStatementResult>;

  listStatements(params?: ListStatementsParams): Promise<BankStatementSummaryDTO[]>;
  getStatement(id: string, params?: GetStatementParams): Promise<BankStatementDetailDTO>;

  applyAutoRules(statementId: string): Promise<ApplyRulesResult>;
  suggestMatches(statementId: string): Promise<MatchSuggestionDTO[]>;
  closeStatement(statementId: string): Promise<void>;

  reconcileMovement(
    movementId: string,
    entityLinks: Array<{
      entityType: "invoice" | "payable_entry";
      entityId: string;
      allocatedAmountCents: number;
      supplierId?: string | null;
    }>
  ): Promise<void>;

  classifyMovement(movementId: string, payload: ClassifyMovementPayload): Promise<void>;
  uploadMovementDocument(movementId: string, file: File): Promise<{ documentUrl: string }>;
  findMovementCandidates(movementId: string): Promise<MovementCandidateDTO[]>;

  deleteStatement(id: string): Promise<void>;
  updateStatementBalances(id: string, openingBalance: number, closingBalance: number): Promise<void>;

  listRules(): Promise<ReconciliationRuleDTO[]>;
  createRule(payload: CreateRulePayload): Promise<ReconciliationRuleDTO>;
  deleteRule(id: string): Promise<void>;

  /** Calendar paradigm — new endpoints. */
  getAccountCalendar(accountId: string, year: number): Promise<AccountMonthStatDTO[]>;
  getAccountMonthDetail(accountId: string, year: number, month: number): Promise<DaySlotDTO[]>;

  /** Returns bank movements reconciled to the given invoice. */
  getMovementsLinkedToInvoice(invoiceId: string): Promise<InvoiceLinkedMovementDTO[]>;

  /**
   * Returns the open balance (cents) for each invoice ID.
   * Result key is invoiceId; invoices with no links have openBalance = totalWithVat.
   */
  getInvoiceOpenBalances(invoiceIds: string[]): Promise<Record<string, number>>;

  /** Cancels reconciliation for a movement: removes all entity links and resets its status. */
  unreconcileMovement(movementId: string): Promise<void>;

  /**
   * Searches recurrence occurrences without an invoice, for use in the
   * "contrato_recorrencia" justify flow.
   */
  searchOccurrenceCandidates(params: { q?: string; dateFrom?: string; dateTo?: string; limit?: number }): Promise<OccurrenceCandidateDTO[]>;
}
