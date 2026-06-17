import type {
  PayableEntryDTO,
  PayableSummaryDTO,
  PayableCalendarDayDTO,
  CreatePayableEntryPayload,
  UpdatePayableEntryPayload,
  ListPayableEntriesParams,
} from "../../entities/payable-entry.ts";

export interface PayableEntriesApiPort {
  listPayableEntries(params?: ListPayableEntriesParams): Promise<PayableEntryDTO[]>;
  getPayableEntry(id: string): Promise<PayableEntryDTO>;
  createPayableEntry(payload: CreatePayableEntryPayload): Promise<PayableEntryDTO>;
  updatePayableEntry(id: string, payload: UpdatePayableEntryPayload): Promise<PayableEntryDTO>;
  markPayableAsPaid(id: string, paidAt?: string): Promise<PayableEntryDTO>;
  cancelPayableEntry(id: string): Promise<PayableEntryDTO>;
  deletePayableEntry(id: string): Promise<void>;
  getPayableSummary(params?: ListPayableEntriesParams): Promise<PayableSummaryDTO>;
  getPayableCalendar(from: string, to: string): Promise<PayableCalendarDayDTO[]>;
}
