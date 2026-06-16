export type InvoiceStatus = "pending" | "paid" | "overdue" | "partial" | "cancelled" | "review";

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

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
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
  costCenterId: string | null;
  category: string | null;
  subcategory: string | null;
  stockItemId: string | null;
  quantity: number;
  unit: string | null;
  unitCostWithoutVat: number;
  vatRate: number;
  vatAmount: number;
  totalWithVat: number;
  stockEntryId: string | null;
  createdAt: string;
}

export interface InvoiceDTO {
  id: string;
  supplierId: string | null;
  supplierName: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string | null;
  paidAt: string | null;
  subtotalWithoutVat: number;
  totalVat: number;
  totalWithVat: number;
  status: InvoiceStatus;
  notes: string | null;
  attachmentUrl: string | null;
  createdAt: string;
  updatedAt: string;
  lines?: InvoiceLineDTO[];
}

export interface CreateInvoiceLinePayload {
  description: string;
  type?: InvoiceLineType;
  costCenterId?: string | null;
  category?: string | null;
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
  subtotalWithoutVat: number;
  totalVat: number;
  totalWithVat: number;
  notes?: string | null;
  lines?: CreateInvoiceLinePayload[];
}

export interface UpdateInvoicePayload {
  supplierId?: string | null;
  supplierName?: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  dueDate?: string | null;
  subtotalWithoutVat?: number;
  totalVat?: number;
  totalWithVat?: number;
  notes?: string | null;
}

export interface ClassifyLinePayload {
  classify: {
    type?: InvoiceLineType;
    costCenterId?: string | null;
    category?: string | null;
  };
  saveAsRule?: boolean;
}

export interface ListInvoicesParams {
  supplierId?: string;
  costCenterId?: string;
  status?: InvoiceStatus;
  from?: string;
  to?: string;
}
