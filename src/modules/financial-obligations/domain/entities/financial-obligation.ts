export type ObligationSource = "recurrence" | "manual";
export type ObligationStatus = "pending" | "paid" | "overdue" | "cancelled";
export type PaymentMethod =
  | "transfer"
  | "direct_debit"
  | "check"
  | "cash"
  | "card"
  | "mbway"
  | "other";

export interface FinancialObligationDTO {
  id: string;
  source: ObligationSource;
  supplierId: string | null;
  supplierName: string;
  description: string;
  amountCents: number;
  dueDate: string;        // YYYY-MM-DD
  paidAt: string | null;  // YYYY-MM-DD
  paymentMethod: PaymentMethod | null;
  status: ObligationStatus;
  invoiceId: string | null;
  recurrenceId: string | null;
  recurrenceName: string | null;
  documentUrl: string | null;
  costCenterId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateManualObligationPayload {
  supplierId?: string | null;
  supplierName: string;
  description: string;
  amountCents: number;
  dueDate: string;         // YYYY-MM-DD
  paymentMethod?: PaymentMethod | null;
  costCenterId?: string | null;
}

export interface MarkObligationAsPaidPayload {
  paidAt?: string;         // YYYY-MM-DD
  paymentMethod?: PaymentMethod;
}

export interface ListObligationsParams {
  from?: string;
  to?: string;
  supplierId?: string;
  status?: ObligationStatus;
  source?: ObligationSource;
}

// ── Labels ────────────────────────────────────────────────────────────────────

export const OBLIGATION_STATUS_LABELS: Record<ObligationStatus, string> = {
  pending: "Pendente",
  paid: "Pago",
  overdue: "Vencido",
  cancelled: "Cancelado",
};

export const OBLIGATION_SOURCE_LABELS: Record<ObligationSource, string> = {
  recurrence: "Recorrência",
  manual: "Manual",
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

// ── Helpers ───────────────────────────────────────────────────────────────────

export function fromCents(n: number): string {
  return (n / 100).toLocaleString("pt-PT", { style: "currency", currency: "EUR" });
}

export function formatDate(d: string): string {
  return new Date(d + "T00:00:00").toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** True se o prazo já passou e a obrigação ainda não foi paga */
export function isEffectivelyOverdue(o: Pick<FinancialObligationDTO, "dueDate" | "status">): boolean {
  if (o.status !== "pending" && o.status !== "overdue") return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(o.dueDate + "T00:00:00") < today;
}

/** Mês corrente no formato YYYY-MM */
export function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}
