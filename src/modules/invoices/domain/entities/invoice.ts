export type InvoiceStatus =
  | "draft_ai"
  | "pending_review"
  | "pending"
  | "paid"
  | "overdue"
  | "partial"
  | "cancelled"
  | "review";

export type InvoiceLineType =
  | "stock_purchase"
  | "operational_expense"
  | "fixed_cost"
  | "variable_cost"
  | "tax"
  | "bank_fee"
  | "salary"
  | "internal_transfer"
  | "service"
  | "mixed"
  | "other";

export type InvoiceSource = "manual" | "pdf_import" | "image_import";
export type AiExtractionStatus = "processing" | "done" | "failed";
export type ReconciliationStatus = "none" | "pending_reconciliation" | "partially_reconciled" | "reconciled";
export type LineDetailMode = "simple" | "detailed";
export type PaymentMethod = "bank_transfer" | "direct_debit" | "mbway" | "card" | "cash" | "cheque" | "other";

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  bank_transfer: "Transferência bancária",
  direct_debit: "Débito direto",
  mbway: "Multibanco/MB Way",
  card: "Cartão",
  cash: "Numerário",
  cheque: "Cheque",
  other: "Outro",
};

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft_ai: "Rascunho",
  pending_review: "Pendente revisão",
  pending: "Pendente",
  paid: "Paga",
  overdue: "Vencida",
  partial: "Parcial",
  cancelled: "Cancelada",
  review: "Em revisão",
};

export const INVOICE_LINE_TYPE_LABELS: Record<InvoiceLineType, string> = {
  stock_purchase: "Compra de Stock",
  operational_expense: "Despesa Operacional",
  fixed_cost: "Custo Fixo",
  variable_cost: "Custo Variável",
  tax: "Imposto",
  bank_fee: "Comissão Bancária",
  salary: "Salário",
  internal_transfer: "Transferência Interna",
  service: "Serviço",
  mixed: "Misto",
  other: "Outro",
};

export interface InvoiceLineDTO {
  id: string;
  invoiceId: string;
  description: string;
  type: InvoiceLineType;
  costCenterCategoryId: string | null;
  stockItemId: string | null;
  quantity: number;
  unit: string | null;
  unitCostWithoutVat: number;
  vatRate: number;
  vatAmount: number;
  totalWithVat: number;
  stockEntryId: string | null;
  affectsDre: boolean;
  affectsCashflow: boolean;
  affectsProfitability: boolean;
  financialType: string | null;
  channelId: string | null;
  requiresChannel: boolean;
  requiresAllocation: boolean;
  dreValue: number;
  cashflowValue: number;
  createdAt: string;
}

export interface InvoiceDTO {
  id: string;
  supplierId: string | null;
  supplierName: string;
  supplierNifSnapshot: string | null;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string | null;
  paidAt: string | null;
  isDirectDebit: boolean;
  directDebitDate: string | null; // YYYY-MM-DD
  subtotalWithoutVat: number;
  totalVat: number;
  totalWithVat: number;
  status: InvoiceStatus;
  notes: string | null;
  attachmentUrl: string | null;
  source: InvoiceSource;
  aiExtractionStatus: AiExtractionStatus | null;
  aiConfidence: number | null;
  requiresReview: boolean;
  costCenterGroupId: string | null;
  costCenterCategoryId: string | null;
  financialType: string | null;
  affectsDre: boolean;
  affectsCashflow: boolean;
  affectsProfitability: boolean;
  currency: string;
  reconciliationStatus: ReconciliationStatus;
  lineDetailMode: LineDetailMode;
  paymentBankAccountId: string | null;
  paymentMethod: string | null;
  paymentNotes: string | null;
  competenceDate: string | null;
  createdAt: string;
  updatedAt: string;
  lines?: InvoiceLineDTO[];
}

export interface SupplierMatchDTO {
  id: string;
  name: string;
  nif: string | null;
  defaultCostCenterGroupId: string | null;
  defaultCostCenterCategoryId: string | null;
  defaultFinancialType: string | null;
}

export interface AiExtractedLineDTO {
  description: string;
  quantity: number | null;
  unitPriceWithoutVat: number | null;
  vatRate: number | null;
  vatAmount: number | null;
  totalWithoutVat: number | null;
  totalWithVat: number | null;
}

export interface InvoiceImportResultDTO {
  invoice: InvoiceDTO;
  aiConfidence: number;
  validationIssues: string[];
  supplierMatch: SupplierMatchDTO | null;
  extractedLines: AiExtractedLineDTO[];
}

export interface InvoiceAlertsDTO {
  overdue: { count: number; totalAmount: number };
  dueToday: { count: number; totalAmount: number };
  dueIn7Days: { count: number; totalAmount: number };
  pendingReconciliation: { count: number; totalAmount: number };
  noDueDateCount: number;
  noSupplierCount: number;
  pendingReviewCount: number;
  lowAiConfidenceCount: number;
  valueDiscrepancyCount: number;
}

export interface CreateInvoiceLinePayload {
  description: string;
  type?: InvoiceLineType;
  costCenterCategoryId?: string | null;
  quantity: number;
  unit?: string | null;
  unitCostWithoutVat: number;
  vatRate: number;
  vatAmount: number;
  totalWithVat: number;
}

export interface CreateInvoicePayload {
  supplierId?: string | null;
  supplierName: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate?: string | null;
  isDirectDebit?: boolean;
  directDebitDate?: string | null;
  subtotalWithoutVat: number;
  totalVat: number;
  totalWithVat: number;
  notes?: string | null;
  lines?: CreateInvoiceLinePayload[];
}

export interface UpdateInvoicePayload {
  supplierId?: string | null;
  supplierName?: string;
  supplierNifSnapshot?: string | null;
  invoiceNumber?: string;
  invoiceDate?: string;
  dueDate?: string | null;
  isDirectDebit?: boolean;
  directDebitDate?: string | null;
  subtotalWithoutVat?: number;
  totalVat?: number;
  totalWithVat?: number;
  notes?: string | null;
  costCenterGroupId?: string | null;
  costCenterCategoryId?: string | null;
  financialType?: string | null;
  affectsDre?: boolean;
  affectsCashflow?: boolean;
  affectsProfitability?: boolean;
  currency?: string;
}

export interface NewSupplierPayload {
  name: string;
  nif?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  iban?: string | null;
  defaultCostCenterGroupId?: string | null;
  defaultCostCenterCategoryId?: string | null;
  paymentTermsDays?: number | null;
}

export interface ConfirmImportedInvoicePayload {
  supplierId?: string | null;
  newSupplier?: NewSupplierPayload;
  supplierName?: string;
  supplierNifSnapshot?: string | null;
  invoiceNumber?: string;
  invoiceDate?: string;
  dueDate?: string | null;
  isDirectDebit?: boolean;
  directDebitDate?: string | null;
  subtotalWithoutVat?: number;
  totalVat?: number;
  totalWithVat?: number;
  notes?: string | null;
  costCenterGroupId?: string | null;
  costCenterCategoryId?: string | null;
  financialType?: string | null;
  affectsDre?: boolean;
  affectsCashflow?: boolean;
  affectsProfitability?: boolean;
  currency?: string;
  saveAsPayable?: boolean;
  markAsPaid?: boolean;
  paidAt?: string; // YYYY-MM-DD — used when markAsPaid is true
  lines?: CreateInvoiceLinePayload[];
}

export interface UpdateInvoiceLinePayload {
  description?: string;
  quantity?: number;
  unit?: string | null;
  unitCostWithoutVat?: number;
  vatRate?: number;
  vatAmount?: number;
  totalWithVat?: number;
}

export interface ClassifyLinePayload {
  classify: {
    type?: InvoiceLineType;
    costCenterCategoryId?: string | null;
    stockItemId?: string | null;
    channelId?: string | null;
  };
  saveAsRule?: boolean;
}

export interface SuggestClassificationResult {
  costCenterCategoryId: string | null;
  defaultLineType: string | null;
  channelId: string | null;
}

export interface ListInvoicesParams {
  supplierId?: string;
  costCenterId?: string;
  status?: InvoiceStatus;
  reconciliationStatus?: ReconciliationStatus;
  from?: string;
  to?: string;
  isDirectDebit?: boolean;
  search?: string;
}

export const VALIDATION_ISSUE_LABELS: Record<string, string> = {
  no_due_date: "Sem data de vencimento",
  no_supplier_match: "Fornecedor não encontrado no cadastro",
  low_ai_confidence: "Confiança da IA abaixo do limite",
  value_discrepancy: "Divergência entre subtotal + IVA e total",
  duplicate_invoice: "Fatura duplicada (mesmo número e fornecedor)",
};
