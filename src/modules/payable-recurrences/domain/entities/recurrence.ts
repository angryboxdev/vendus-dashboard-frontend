export type RecurrenceType =
  | "fixed_contract"
  | "variable_invoice"
  | "recurring_service"
  | "payroll"
  | "bank_auto"
  | "fiscal";

export type RecurrenceFrequency = "monthly" | "quarterly" | "annual";
export type RecurrenceStatus = "active" | "paused" | "closed";
export type PaymentMethod =
  | "transfer"
  | "direct_debit"
  | "check"
  | "cash"
  | "card"
  | "mbway"
  | "other";
export type OccurrenceStatus =
  | "forecast"
  | "awaiting_invoice"
  | "invoice_linked"
  | "paid"
  | "cancelled";

export const RECURRENCE_TYPE_LABELS: Record<RecurrenceType, string> = {
  fixed_contract: "Contrato fixo",
  variable_invoice: "Variável",
  recurring_service: "Serviço recorrente",
  payroll: "Pessoal",
  bank_auto: "Banco (automático)",
  fiscal: "Fiscal",
};

export const RECURRENCE_FREQUENCY_LABELS: Record<RecurrenceFrequency, string> = {
  monthly: "Mensal",
  quarterly: "Trimestral",
  annual: "Anual",
};

export const RECURRENCE_STATUS_LABELS: Record<RecurrenceStatus, string> = {
  active: "Ativa",
  paused: "Pausada",
  closed: "Encerrada",
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  transfer: "Transferência",
  direct_debit: "Débito direto",
  check: "Cheque",
  cash: "Numerário",
  card: "Cartão",
  mbway: "MBWay",
  other: "Outro",
};

export const OCCURRENCE_STATUS_LABELS: Record<OccurrenceStatus, string> = {
  forecast: "Previsão",
  awaiting_invoice: "A aguardar fatura",
  invoice_linked: "Fatura vinculada",
  paid: "Pago",
  cancelled: "Cancelado",
};

export interface RecurrenceDTO {
  id: string;
  name: string;
  supplierId: string | null;
  supplierName: string;
  type: RecurrenceType;
  frequency: RecurrenceFrequency;
  costCenterId: string | null;
  costCenterCategoryId: string | null;
  category: string | null;
  estimatedAmountCents: number;
  dayOfMonth: number;
  startDate: string;
  endDate: string | null;
  paymentMethod: PaymentMethod;
  requireInvoice: boolean;
  status: RecurrenceStatus;
  notes: string | null;
  documentUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OccurrenceDTO {
  id: string;
  recurrenceId: string;
  period: string;
  estimatedAmountCents: number;
  realAmountCents: number | null;
  effectiveAmountCents: number;
  dueDate: string;
  status: OccurrenceStatus;
  requireInvoice: boolean;
  invoiceId: string | null;
  paidAt: string | null;
  paymentMethod: PaymentMethod | null;
  paymentBankAccountId: string | null;
  paymentNotes: string | null;
  notes: string | null;
  documentUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRecurrencePayload {
  name: string;
  supplierId?: string | null;
  supplierName: string;
  type: RecurrenceType;
  frequency: RecurrenceFrequency;
  costCenterId?: string | null;
  costCenterCategoryId?: string | null;
  category?: string | null;
  estimatedAmountCents: number;
  dayOfMonth: number;
  startDate: string;
  endDate?: string | null;
  paymentMethod: PaymentMethod;
  requireInvoice: boolean;
  notes?: string | null;
}

export interface UpdateRecurrencePayload {
  name?: string;
  supplierId?: string | null;
  supplierName?: string;
  costCenterId?: string | null;
  costCenterCategoryId?: string | null;
  category?: string | null;
  estimatedAmountCents?: number;
  dayOfMonth?: number;
  endDate?: string | null;
  paymentMethod?: PaymentMethod;
  requireInvoice?: boolean;
  notes?: string | null;
}

export interface MarkOccurrenceAsPaidPayload {
  paidAt?: string;
  paymentMethod?: PaymentMethod;
  paymentBankAccountId?: string;
  paymentNotes?: string;
}

export interface OccurrenceWithRecurrenceDTO {
  occurrence: OccurrenceDTO;
  recurrenceName: string;
}

export interface RecurrenceSummaryDTO {
  awaitingInvoiceCount: number;
}

export interface ListRecurrencesParams {
  status?: RecurrenceStatus;
  type?: RecurrenceType;
  supplierId?: string;
}

export interface ListOccurrencesParams {
  period?: string;
  status?: OccurrenceStatus;
}

/** Derive expected document label from recurrence type/flags */
export function expectedDocumentLabel(
  r: Pick<RecurrenceDTO, "requireInvoice" | "type">,
): string {
  if (r.requireInvoice) return "Fatura";
  switch (r.type) {
    case "fixed_contract": return "Contrato";
    case "payroll": return "Folha salarial";
    case "bank_auto": return "Comprovativo";
    case "fiscal": return "Doc. fiscal";
    default: return "Nenhum";
  }
}

/** Calculate the next occurrence due date from dayOfMonth */
export function nextDueDate(dayOfMonth: number): Date {
  const now = new Date();
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), dayOfMonth);
  if (thisMonth > now) return thisMonth;
  return new Date(now.getFullYear(), now.getMonth() + 1, dayOfMonth);
}

/** Format "YYYY-MM" → "março 2026" */
export function formatPeriod(period: string): string {
  const [year, month] = period.split("-");
  const d = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
  return d.toLocaleDateString("pt-PT", { month: "long", year: "numeric" });
}
