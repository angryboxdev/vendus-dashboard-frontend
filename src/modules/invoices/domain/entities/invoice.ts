export type InvoiceStatus =
  | "draft_ai"
  | "pending_review"
  | "pending"
  | "paid"
  | "overdue"
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
/** Fatura = aumenta o valor devido ao fornecedor. Nota de crédito = reduz (totais sempre negativos). */
export type InvoiceDocumentType = "invoice" | "credit_note";
export type AiExtractionStatus = "processing" | "done" | "failed";
export type ReconciliationStatus = "none" | "pending_reconciliation" | "partially_reconciled" | "reconciled";
/** simple = «Única», detailed = «Por artigo», by_values = «Por valores» (F2 §2.2). */
export type LineDetailMode = "simple" | "detailed" | "by_values";
export type FinancialModeName = "single" | "by_item" | "by_values";
export type PaymentMethod = "bank_transfer" | "direct_debit" | "mbway" | "card" | "cash" | "cheque" | "other";

/** Módulo "Compra por rever" (stock-purchase-review) — decide se a fatura força/ignora a geração de revisão de stock, ou deixa a decisão automática (categoria/fornecedor). */
export type StockReviewOverride = "auto" | "force_create" | "force_skip";

export const STOCK_REVIEW_OVERRIDE_LABELS: Record<StockReviewOverride, string> = {
  auto: "Automático (categoria/fornecedor)",
  force_create: "Forçar criação de revisão",
  force_skip: "Não criar revisão",
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  bank_transfer: "Transferência bancária",
  direct_debit: "Débito direto",
  mbway: "Multibanco/MB Way",
  card: "Cartão",
  cash: "Numerário",
  cheque: "Cheque",
  other: "Outro",
};

export const DOCUMENT_TYPE_LABELS: Record<InvoiceDocumentType, string> = {
  invoice: "Fatura",
  credit_note: "Nota de crédito",
};

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft_ai: "Rascunho",
  pending_review: "Pendente revisão",
  pending: "Pendente",
  paid: "Paga",
  overdue: "Vencida",
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
  /** Nullable: a cost may belong to the organization and to no store (D4). */
  locationId: string | null;
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
  /** Módulo Contabilidade — `null` = usa a sugestão da subcategoria (`vatDeductible` boolean → 100% ou 0%). */
  deductiblePercentage: number | null;
  /** Obrigatório sempre que `deductiblePercentage` não é `null` (validado no backend). */
  deductibilityOverrideReason: string | null;
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
  documentType: InvoiceDocumentType;
  status: InvoiceStatus;
  notes: string | null;
  attachmentUrl: string | null;
  source: InvoiceSource;
  aiExtractionStatus: AiExtractionStatus | null;
  aiConfidence: number | null;
  requiresReview: boolean;
  /** true quando outra fatura activa (não cancelada) do mesmo fornecedor tem o mesmo número. Calculado pelo backend a cada listagem. */
  isDuplicate: boolean;
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
  /** Default `"auto"` — deixa o backend decidir (categoria/fornecedor, nunca Centro de Custo) se gera revisão de impacto em stock. */
  stockReviewOverride: StockReviewOverride;
  stockReviewOverrideReason: string | null;
  createdAt: string;
  updatedAt: string;
  /** Versão (bloqueio otimista) — enviar como `expectedVersion` ao confirmar. */
  version?: number;
  /** F2 §2.2: «Única» | «Por artigo» | «Por valores». */
  financialMode?: FinancialModeName;
  /** Modo «Por valores»: repartições financeiras (não são artigos). */
  allocations?: InvoiceAllocationDTO[];
  lines?: InvoiceLineDTO[];
  linesSummary?: {
    subtotalWithoutVat: number;
    totalVat: number;
    totalWithVat: number;
    totalsMismatch: boolean;
  };
  classificationSummary: {
    mode: "unique" | "mixed" | "none";
    /** "net" = montantes líquidos sem IVA (modo «Por valores»). */
    basis?: "net";
    entries: Array<{
      costCenterCategoryId: string;
      code: string;
      name: string;
      financialType: string | null;
      totalWithVat: number;
    }>;
  };
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
  /** Texto tal como impresso (ex.: "20.000", "1,235") — o servidor resolve a leitura que reconcilia. */
  quantityText?: string | null;
  unitPriceText?: string | null;
  /** Bruto da linha antes de descontos (cêntimos), quando impresso. */
  grossWithoutDiscount?: number | null;
  /** Desconto comercial da linha: % (10 = 10%) ou valor em cêntimos. */
  discountPct?: number | null;
  discountAmount?: number | null;
}

export interface VatSummaryEntry {
  rate: number;
  baseCents: number;
  vatCents: number;
}

/** Identidade fiscal do documento importado (F1 v1.2) — avisos na revisão. */
export interface ImportFiscalInfo {
  kind: "new" | "ok" | "incomplete" | "existing_finance" | "existing_stock_only" | "possible_duplicate" | string;
  existingInvoiceId?: string | null;
  identityId?: string;
  candidates?: { invoiceId: string | null; seriesNumber: string }[];
  missing?: string[];
}

export interface InvoiceImportResultDTO {
  invoice: InvoiceDTO;
  aiConfidence: number;
  validationIssues: string[];
  supplierMatch: SupplierMatchDTO | null;
  extractedLines: AiExtractedLineDTO[];
  /** Descontos globais/rodapé e quadro de IVA extraídos. */
  extractedAmounts?: { globalDiscountPct: number | null; globalDiscountAmount: number | null; footerDiscountAmount: number | null; vatSummary: VatSummaryEntry[] | null };
  /** O documento já existia (mesmo ficheiro ou mesma identidade fiscal): é devolvido o existente. */
  reused?: "same_file" | "same_fiscal_identity";
  fiscal?: ImportFiscalInfo;
}

/** Repartição «Por valores»: descrição + subcategoria (+ loja) + montante líquido em cêntimos. */
export interface AllocationPayload {
  description: string;
  costCenterGroupId?: string | null;
  costCenterCategoryId: string;
  locationId?: string | null;
  netCents: number;
}

export interface InvoiceAllocationDTO extends AllocationPayload {
  id: string;
  invoiceId: string;
  position: number;
  costCenterGroupId: string | null;
  locationId: string | null;
}

/** Sugestão «Enviar para Stock» (F2 §2.1). */
export interface StockRoutingSuggestion {
  send: boolean | null;
  source: "supplier_location" | "supplier" | "category" | "none";
  reason: string;
  requiresDecision: boolean;
}

/** «Guardar rascunho»: estado da conferência. */
export interface SaveDraftResultDTO {
  invoice: InvoiceDTO;
  differenceCents: number | null;
  remainingCents: number | null;
  readyToFinalize: boolean;
  blockingReason: string | null;
}

/** «Total a pagar | Em atraso» (F2 §2.3). */
export interface PayablesSummaryDTO {
  currency: string;
  today: string;
  totalOpenCents: number;
  overdueCents: number;
  documents: number;
  missingDueDate: { count: number; cents: number };
  multiLocationDocuments: number;
  suspectedDuplicates: number;
  unappliedCreditCents: number;
  otherCurrencies: string[];
}

export interface PayablesSummaryParams {
  search?: string;
  from?: string;
  to?: string;
  supplierId?: string;
  locationId?: string;
  currency?: string;
}

export interface AmountDiscountPayload {
  kind: "pct" | "amount";
  /** % (10 = 10%) ou cêntimos. */
  value: number;
}

/** Valores do documento — o servidor recalcula tudo com o motor único ao finalizar (F1 §1.3). */
export interface DocumentAmountsPayload {
  globalDiscount?: AmountDiscountPayload | null;
  footerDiscountCents?: number | null;
  adjustmentsCents?: number;
  vatSummary?: VatSummaryEntry[] | null;
  roundingAdjustment?: { cents: number; reason: string } | null;
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
  /** Optional (D4): omitted means "organization-wide, no store". Never defaulted. */
  locationId?: string | null;
  /** Texto exato da quantidade/preço (vírgula decimal) — o servidor recalcula sem perder casas decimais. */
  quantityText?: string | null;
  unitPriceText?: string | null;
  grossCentsPrinted?: number | null;
  discount?: AmountDiscountPayload | null;
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
  stockReviewOverride?: StockReviewOverride;
  stockReviewOverrideReason?: string | null;
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
  documentType?: InvoiceDocumentType;
  notes?: string | null;
  costCenterGroupId?: string | null;
  costCenterCategoryId?: string | null;
  financialType?: string | null;
  affectsDre?: boolean;
  affectsCashflow?: boolean;
  affectsProfitability?: boolean;
  currency?: string;
  stockReviewOverride?: StockReviewOverride;
  stockReviewOverrideReason?: string | null;
  /** Ver STOCK_REVIEW_REMOVAL_CONFIRMATION_REQUIRED — confirma que o utilizador aceita remover uma revisão de stock ainda não aplicada para prosseguir com esta alteração. */
  confirmRemoveStockReview?: boolean;
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
  documentType?: InvoiceDocumentType;
  notes?: string | null;
  costCenterGroupId?: string | null;
  costCenterCategoryId?: string | null;
  financialType?: string | null;
  affectsDre?: boolean;
  affectsCashflow?: boolean;
  affectsProfitability?: boolean;
  currency?: string;
  stockReviewOverride?: StockReviewOverride;
  stockReviewOverrideReason?: string | null;
  saveAsPayable?: boolean;
  markAsPaid?: boolean;
  paidAt?: string; // YYYY-MM-DD — used when markAsPaid is true
  lines?: CreateInvoiceLinePayload[];
  amounts?: DocumentAmountsPayload;
  /** Bloqueio otimista (409 `version_conflict` se a fatura mudou entretanto). */
  expectedVersion?: number;
  /** A pessoa comparou com os documentos parecidos e confirmou que é outro documento. */
  notADuplicate?: boolean;
  /** Completar o documento que já existe só no Stock (sem nova revisão de stock). */
  completeStockIdentityId?: string;
  /** F2 §2.2: modo financeiro; «Por valores» exige `allocations` (soma = base líquida). */
  financialMode?: FinancialModeName;
  allocations?: AllocationPayload[];
}

export interface UpdateInvoiceLinePayload {
  description?: string;
  quantity?: number;
  unit?: string | null;
  unitCostWithoutVat?: number;
  vatRate?: number;
  vatAmount?: number;
  totalWithVat?: number;
  /** Optional (D4): omitted means "organization-wide, no store". Never defaulted. */
  locationId?: string | null;
}

/** Módulo Contabilidade — override de dedutibilidade de IVA por linha de fatura. `deductiblePercentage: null` repõe a sugestão da subcategoria. */
export interface SetLineDeductibilityOverridePayload {
  deductiblePercentage: number | null;
  deductibilityOverrideReason: string | null;
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
  documentType?: InvoiceDocumentType;
  search?: string;
}

export const VALIDATION_ISSUE_LABELS: Record<string, string> = {
  no_due_date: "Sem data de vencimento",
  no_supplier_match: "Fornecedor não encontrado no cadastro",
  low_ai_confidence: "Confiança da IA abaixo do limite",
  value_discrepancy: "Divergência entre subtotal + IVA e total",
  duplicate_invoice: "Fatura duplicada (mesmo número e fornecedor)",
  supplier_is_own_company: "IA identificou a própria empresa como fornecedor — corrige manualmente",
  credit_note_detected: "Identificado como Nota de Crédito — confirma o tipo de documento",
  exists_in_stock: "Este documento já foi importado no Stock — ao confirmar completa o mesmo lançamento (sem duplicar stock)",
  possible_duplicate: "Possível duplicado: há um documento parecido do mesmo fornecedor — compare antes de confirmar",
  fiscal_identity_incomplete: "Falta o NIF do fornecedor ou o número do documento — complete os dados",
};
