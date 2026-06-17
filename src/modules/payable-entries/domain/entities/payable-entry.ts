export type RecurrenceType = "none" | "monthly" | "quarterly" | "annual";
export type PayableStatus = "pending" | "paid" | "overdue" | "cancelled";

export const PAYABLE_STATUS_LABELS: Record<PayableStatus, string> = {
  pending: "Pendente",
  paid: "Pago",
  overdue: "Vencido",
  cancelled: "Cancelado",
};

export const RECURRENCE_LABELS: Record<RecurrenceType, string> = {
  none: "—",
  monthly: "Mensal",
  quarterly: "Trimestral",
  annual: "Anual",
};

export interface PayableEntryDTO {
  id: string;
  invoiceId: string | null;
  supplierId: string | null;
  supplierName: string;
  description: string;
  costCenterId: string | null;
  category: string | null;
  amount: number; // cents
  dueDate: string; // YYYY-MM-DD
  paidAt: string | null; // YYYY-MM-DD
  recurrence: RecurrenceType;
  status: PayableStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PayableSummaryDTO {
  totalDue: number;      // cents
  totalOverdue: number;  // cents
  dueSoon7Days: number;  // cents
  paidThisMonth: number; // cents
}

export interface PayableCalendarDayDTO {
  date: string; // YYYY-MM-DD
  entries: PayableEntryDTO[];
  totalAmount: number; // cents
}

export interface CreatePayableEntryPayload {
  supplierId?: string | null;
  supplierName: string;
  description: string;
  costCenterId?: string | null;
  category?: string | null;
  amount: number; // cents
  dueDate: string; // YYYY-MM-DD
  recurrence?: RecurrenceType;
  notes?: string | null;
}

export interface UpdatePayableEntryPayload {
  supplierName?: string;
  description?: string;
  costCenterId?: string | null;
  category?: string | null;
  amount?: number;
  dueDate?: string;
  recurrence?: RecurrenceType;
  notes?: string | null;
}

export interface ListPayableEntriesParams {
  supplierId?: string;
  costCenterId?: string;
  status?: PayableStatus;
  from?: string;
  to?: string;
}
