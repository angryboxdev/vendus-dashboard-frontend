export type AccountingDocumentType =
  | "partner_invoice"
  | "employee_invoice"
  | "platform_commission"
  | "credit_note"
  | "manual"
  | "regularization"
  | "other";

export const ACCOUNTING_DOCUMENT_TYPES: AccountingDocumentType[] = [
  "partner_invoice",
  "employee_invoice",
  "platform_commission",
  "credit_note",
  "manual",
  "regularization",
  "other",
];

export const DOCUMENT_TYPE_LABELS: Record<AccountingDocumentType, string> = {
  partner_invoice: "Fatura de sócio",
  employee_invoice: "Fatura de funcionário",
  platform_commission: "Comissão de plataforma",
  credit_note: "Nota de crédito",
  manual: "Documento manual",
  regularization: "Regularização",
  other: "Outro",
};

/** Deliberadamente sem banco/cartão/caixa da empresa — esse fluxo é sempre uma Fatura normal (módulo Faturas), nunca um AccountingDocument. */
export type AccountingFundingSource = "partner" | "employee" | "platform" | "other";

export const ACCOUNTING_FUNDING_SOURCES: AccountingFundingSource[] = ["partner", "employee", "platform", "other"];

export const FUNDING_SOURCE_LABELS: Record<AccountingFundingSource, string> = {
  partner: "Sócio",
  employee: "Funcionário",
  platform: "Plataforma",
  other: "Outra",
};

export type AccountingSettlementMethod = "reimbursement" | "partner_current_account" | "other";

export const ACCOUNTING_SETTLEMENT_METHODS: AccountingSettlementMethod[] = [
  "reimbursement",
  "partner_current_account",
  "other",
];

export const SETTLEMENT_METHOD_LABELS: Record<AccountingSettlementMethod, string> = {
  reimbursement: "Reembolso",
  partner_current_account: "Conta corrente de sócio",
  other: "Outra",
};

/** `closed` existe no tipo mas nenhum endpoint o define ainda — não construir UI para essa transição. */
export type AccountingDocumentStatus = "pending_review" | "validated" | "with_pendency" | "closed" | "cancelled";

export const STATUS_LABELS: Record<AccountingDocumentStatus, string> = {
  pending_review: "Por rever",
  validated: "Validado",
  with_pendency: "Com pendência",
  closed: "Fechado",
  cancelled: "Cancelado",
};

/** Cor de texto simples — nunca badge/pill (decisão de design do módulo). */
export const STATUS_TEXT_COLOR: Record<AccountingDocumentStatus, string> = {
  pending_review: "text-amber-600",
  validated: "text-emerald-600",
  with_pendency: "text-red-600",
  closed: "text-stone-500",
  cancelled: "text-stone-400",
};

export interface AccountingDocumentAttachment {
  id: string;
  documentId: string;
  storagePath: string;
  fileType: string;
  fileHash: string;
  version: number;
  uploadedBy: string;
  uploadedAt: string;
}

/** Documento completo do módulo Contabilidade — só existe para `source: "accounting_document"`; faturas continuam a viver só em `invoices`. */
export interface AccountingDocumentDTO {
  id: string;
  documentType: AccountingDocumentType;
  fundingSource: AccountingFundingSource;
  entityName: string;
  nif: string | null;
  documentNumber: string | null;
  issueDate: string;
  receivedDate: string | null;
  competenceDate: string | null;
  currency: string;
  country: string;
  subtotalWithoutVat: number;
  vatAmount: number;
  totalWithVat: number;
  costCenterCategoryId: string | null;
  /** `null` = usa a sugestão da subcategoria (`vatDeductible` boolean → 100% ou 0%). */
  deductiblePercentage: number | null;
  /** Obrigatório sempre que `deductiblePercentage` não é `null` (validado no backend). */
  deductibilityOverrideReason: string | null;
  vatDeductibleAmount: number;
  vatNonDeductibleAmount: number;
  settlementMethod: AccountingSettlementMethod;
  status: AccountingDocumentStatus;
  cancellationReason: string | null;
  notes: string | null;
  attachments: AccountingDocumentAttachment[];
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

export type AccountingDocumentSource = "invoice" | "accounting_document";

/**
 * Linha da vista agregada "Documentos" (decisão confirmada com o utilizador,
 * nunca um CRUD paralelo de faturas). `source: "invoice"` vem do módulo
 * Faturas e é só de leitura aqui; só `source: "accounting_document"` abre o
 * drawer de edição.
 */
export interface AccountingDocumentRowDTO {
  id: string;
  source: AccountingDocumentSource;
  documentType: string;
  fundingSource: string | null;
  entityName: string;
  nif: string | null;
  documentNumber: string | null;
  date: string;
  totalWithVat: number;
  status: string;
  costCenterCategoryId: string | null;
}

export interface ListAccountingDocumentsParams {
  from?: string;
  to?: string;
}

export interface CreateAccountingDocumentPayload {
  documentType: AccountingDocumentType;
  fundingSource: AccountingFundingSource;
  entityName: string;
  nif?: string | null;
  documentNumber?: string | null;
  issueDate: string;
  receivedDate?: string | null;
  competenceDate?: string | null;
  currency?: string;
  country?: string;
  subtotalWithoutVat: number;
  vatAmount: number;
  totalWithVat: number;
  costCenterCategoryId?: string | null;
  deductiblePercentage?: number | null;
  deductibilityOverrideReason?: string | null;
  settlementMethod: AccountingSettlementMethod;
  notes?: string | null;
  /** Reenvia o mesmo pedido depois de o utilizador confirmar o alerta de possível duplicado. */
  confirmDuplicate?: boolean;
}

export interface UpdateAccountingDocumentPayload {
  documentType?: AccountingDocumentType;
  fundingSource?: AccountingFundingSource;
  entityName?: string;
  nif?: string | null;
  documentNumber?: string | null;
  issueDate?: string;
  receivedDate?: string | null;
  competenceDate?: string | null;
  currency?: string;
  country?: string;
  subtotalWithoutVat?: number;
  vatAmount?: number;
  totalWithVat?: number;
  costCenterCategoryId?: string | null;
  deductiblePercentage?: number | null;
  deductibilityOverrideReason?: string | null;
  settlementMethod?: AccountingSettlementMethod;
  notes?: string | null;
  confirmDuplicate?: boolean;
}

/** Candidato devolvido no 409 de possível duplicado (secção 9 da task do backend) — nunca fabricar campos além destes. */
export interface AccountingDuplicateCandidate {
  source: AccountingDocumentSource;
  id: string;
  label: string;
}
