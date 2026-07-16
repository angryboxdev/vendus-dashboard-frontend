export type ReconciliationStatus =
  | "conciliado_com_fatura"
  | "conciliado_sem_fatura"
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
export type StatementSourceType = "csv" | "xlsx" | "manual";
export type MatchedEntityType =
  | "invoice"
  | "payable_entry"
  | "receipt"
  | "internal_transfer"
  | "manual_entry";

// ── Labels ────────────────────────────────────────────────────────────────────

export const RECONCILIATION_STATUS_LABELS: Record<ReconciliationStatus, string> = {
  conciliado_com_fatura: "Conciliado c/ Fatura",
  conciliado_sem_fatura: "Conciliado s/ Fatura",
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
  "transferencia_interna",
  "ignorado_com_motivo",
]);

// ── DTOs ──────────────────────────────────────────────────────────────────────

export interface BankStatementSummaryDTO {
  id: string;
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

export interface BankMovementDTO {
  id: string;
  bookingDate: string;    // ISO date
  valueDate: string;      // ISO date
  description: string;
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
}

export interface BankStatementDetailDTO extends BankStatementSummaryDTO {
  sourceFileName: string | null;
  movements: BankMovementDTO[];
  statusCounts: Partial<Record<ReconciliationStatus, number>>;
}

export interface ImportStatementResult {
  id: string;
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

export interface ReconciliationRuleDTO {
  id: string;
  name: string;
  descriptionContains: string;
  movementType: MovementType | null;
  justificationType: JustificationType;
  requiresDocument: boolean;
  riskLevel: RiskLevel;
  isActive: boolean;
  createdAt: string;
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
  amountCents: number;
  date: string;
  confidence: number;
}

export interface CreateRulePayload {
  name: string;
  descriptionContains: string;
  movementType?: MovementType | null;
  justificationType: JustificationType;
  requiresDocument?: boolean;
  riskLevel?: RiskLevel;
}
