import type {
  InvoiceDTO,
  InvoiceLineDTO,
  InvoiceStatus,
  CreateInvoicePayload,
  UpdateInvoicePayload,
  UpdateInvoiceLinePayload,
  ClassifyLinePayload,
  ListInvoicesParams,
  InvoiceImportResultDTO,
  InvoiceAlertsDTO,
  ConfirmImportedInvoicePayload,
  SuggestClassificationResult,
  LineDetailMode,
  InvoiceDocumentType,
  SetLineDeductibilityOverridePayload,
  AllocationPayload,
  InvoiceAllocationDTO,
  PayablesSummaryDTO,
  PayablesSummaryParams,
  SaveDraftResultDTO,
  StockRoutingSuggestion,
} from "../../entities/invoice.ts";
import type { PaymentDocumentImportDTO } from "../../entities/payment-document.ts";

export interface AddInvoiceLinePayload {
  description: string;
  type?: string;
  costCenterCategoryId?: string | null;
  quantity: number;
  unit?: string | null;
  unitCostWithoutVat: number;
  vatRate: number;
  vatAmount: number;
  totalWithVat: number;
  /** Optional (D4): omitted means "organization-wide, no store". Never defaulted. */
  locationId?: string | null;
}

export interface InvoicesApiPort {
  listInvoices(params?: ListInvoicesParams): Promise<InvoiceDTO[]>;
  listInvoiceLines(): Promise<InvoiceLineDTO[]>;
  getInvoice(id: string): Promise<InvoiceDTO>;
  addLine(invoiceId: string, payload: AddInvoiceLinePayload): Promise<InvoiceLineDTO>;
  updateLine(invoiceId: string, lineId: string, payload: UpdateInvoiceLinePayload): Promise<InvoiceLineDTO>;
  createInvoice(payload: CreateInvoicePayload): Promise<InvoiceDTO>;
  updateInvoice(id: string, payload: UpdateInvoicePayload): Promise<InvoiceDTO>;
  markInvoicePaid(id: string, paidAt?: string, bankAccountId?: string | null, paymentMethod?: string | null, paymentNotes?: string | null): Promise<InvoiceDTO>;
  setInvoiceStatus(id: string, status: InvoiceStatus): Promise<InvoiceDTO>;
  setLineDetailMode(id: string, mode: LineDetailMode, confirmRemoveStockReview?: boolean): Promise<InvoiceDTO>;
  deleteInvoice(id: string, confirmRemoveStockReview?: boolean): Promise<void>;
  deleteLine(invoiceId: string, lineId: string): Promise<void>;
  classifyLine(invoiceId: string, lineId: string, payload: ClassifyLinePayload): Promise<InvoiceLineDTO>;
  setLineDeductibilityOverride(invoiceId: string, lineId: string, payload: SetLineDeductibilityOverridePayload): Promise<InvoiceLineDTO>;
  /** Documento de cobrança AT/SS → `PaymentDocumentImportDTO` (não cria fatura); `treatAsInvoice` força o fluxo de faturas. */
  /** `keepDraftLines` (lote, E4): as linhas lidas ficam gravadas no rascunho. */
  importInvoice(file: File, documentType?: InvoiceDocumentType, options?: { treatAsInvoice?: boolean; keepDraftLines?: boolean }): Promise<InvoiceImportResultDTO | PaymentDocumentImportDTO>;
  /** E3b-2: rascunho de obrigação a partir do documento de cobrança (o servidor volta a ler o ficheiro). 409 `obligation_exists` sem `force`. */
  createObligationDraft(file: File, options?: { force?: boolean }): Promise<InvoiceImportResultDTO>;
  /** Liga o documento de cobrança a um registo existente (passa a obrigação; 422 `obligation_link_mismatch`). */
  linkObligation(invoiceId: string, file: File): Promise<InvoiceDTO>;
  confirmImportedInvoice(id: string, payload: ConfirmImportedInvoicePayload): Promise<InvoiceDTO>;
  getInvoiceAlerts(): Promise<InvoiceAlertsDTO>;
  suggestLineClassification(supplierId: string, description?: string): Promise<SuggestClassificationResult | null>;
  // F2 v1.2
  getStockRoutingSuggestion(input: { supplierId: string | null; locationId: string | null; categoryIds: string[] }): Promise<StockRoutingSuggestion>;
  saveInvoiceDraft(id: string, payload: ConfirmImportedInvoicePayload): Promise<SaveDraftResultDTO>;
  replaceInvoiceAllocations(id: string, allocations: AllocationPayload[], expectedVersion?: number): Promise<InvoiceDTO>;
  listInvoiceAllocations(): Promise<InvoiceAllocationDTO[]>;
  getPayablesSummary(params: PayablesSummaryParams): Promise<PayablesSummaryDTO>;
}
