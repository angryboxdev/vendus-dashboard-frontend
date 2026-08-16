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
  setLineDetailMode(id: string, mode: LineDetailMode): Promise<InvoiceDTO>;
  deleteInvoice(id: string): Promise<void>;
  classifyLine(invoiceId: string, lineId: string, payload: ClassifyLinePayload): Promise<InvoiceLineDTO>;
  importInvoice(file: File): Promise<InvoiceImportResultDTO>;
  confirmImportedInvoice(id: string, payload: ConfirmImportedInvoicePayload): Promise<InvoiceDTO>;
  getInvoiceAlerts(): Promise<InvoiceAlertsDTO>;
  suggestLineClassification(supplierId: string, description?: string): Promise<SuggestClassificationResult | null>;
}
