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
} from "../../entities/invoice.ts";

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
  importInvoice(file: File, documentType?: InvoiceDocumentType): Promise<InvoiceImportResultDTO>;
  confirmImportedInvoice(id: string, payload: ConfirmImportedInvoicePayload): Promise<InvoiceDTO>;
  getInvoiceAlerts(): Promise<InvoiceAlertsDTO>;
  suggestLineClassification(supplierId: string, description?: string): Promise<SuggestClassificationResult | null>;
}
