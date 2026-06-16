import type {
  InvoiceDTO,
  InvoiceLineDTO,
  CreateInvoicePayload,
  UpdateInvoicePayload,
  ClassifyLinePayload,
  ListInvoicesParams,
} from "../../entities/invoice.ts";

export interface InvoicesApiPort {
  listInvoices(params?: ListInvoicesParams): Promise<InvoiceDTO[]>;
  getInvoice(id: string): Promise<InvoiceDTO>;
  createInvoice(payload: CreateInvoicePayload): Promise<InvoiceDTO>;
  updateInvoice(id: string, payload: UpdateInvoicePayload): Promise<InvoiceDTO>;
  markInvoicePaid(id: string, paidAt?: string): Promise<InvoiceDTO>;
  deleteInvoice(id: string): Promise<void>;
  classifyLine(invoiceId: string, lineId: string, payload: ClassifyLinePayload): Promise<InvoiceLineDTO>;
}
