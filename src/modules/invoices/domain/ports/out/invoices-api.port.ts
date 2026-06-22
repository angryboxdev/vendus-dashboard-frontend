import type {
  InvoiceDTO,
  InvoiceLineDTO,
  CreateInvoicePayload,
  UpdateInvoicePayload,
  ClassifyLinePayload,
  ListInvoicesParams,
} from "../../entities/invoice.ts";

export interface AddInvoiceLinePayload {
  description: string;
  type?: string;
  costCenterCategoryId?: string | null;
  category?: string | null;
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
  createInvoice(payload: CreateInvoicePayload): Promise<InvoiceDTO>;
  updateInvoice(id: string, payload: UpdateInvoicePayload): Promise<InvoiceDTO>;
  markInvoicePaid(id: string, paidAt?: string): Promise<InvoiceDTO>;
  deleteInvoice(id: string): Promise<void>;
  classifyLine(invoiceId: string, lineId: string, payload: ClassifyLinePayload): Promise<InvoiceLineDTO>;
}
