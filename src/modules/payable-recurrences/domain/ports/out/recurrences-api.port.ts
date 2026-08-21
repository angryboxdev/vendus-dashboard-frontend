import type {
  RecurrenceDTO,
  OccurrenceDTO,
  OccurrenceWithRecurrenceDTO,
  RecurrenceSummaryDTO,
  CreateRecurrencePayload,
  UpdateRecurrencePayload,
  MarkOccurrenceAsPaidPayload,
  ListRecurrencesParams,
  ListOccurrencesParams,
} from "../../entities/recurrence.ts";

export interface RecurrencesApiPort {
  // Summary
  getSummary(): Promise<RecurrenceSummaryDTO>;

  // Recurrences
  listRecurrences(params?: ListRecurrencesParams): Promise<RecurrenceDTO[]>;
  createRecurrence(payload: CreateRecurrencePayload): Promise<RecurrenceDTO>;
  getRecurrence(id: string): Promise<RecurrenceDTO>;
  updateRecurrence(id: string, payload: UpdateRecurrencePayload): Promise<RecurrenceDTO>;
  pauseRecurrence(id: string): Promise<RecurrenceDTO>;
  resumeRecurrence(id: string): Promise<RecurrenceDTO>;
  closeRecurrence(id: string): Promise<RecurrenceDTO>;
  uploadRecurrenceDocument(id: string, file: File): Promise<RecurrenceDTO>;
  deleteRecurrenceDocument(id: string): Promise<void>;

  // Occurrences
  listOccurrences(recurrenceId: string, params?: ListOccurrencesParams): Promise<OccurrenceDTO[]>;
  getOccurrenceByInvoiceId(invoiceId: string): Promise<OccurrenceWithRecurrenceDTO | null>;
  generateOccurrence(recurrenceId: string, year: number, month: number): Promise<OccurrenceDTO>;
  getOccurrence(occId: string): Promise<OccurrenceDTO>;
  linkInvoiceToOccurrence(occId: string, invoiceId: string): Promise<OccurrenceDTO>;
  markOccurrenceAsPaid(occId: string, payload?: MarkOccurrenceAsPaidPayload): Promise<OccurrenceDTO>;
  cancelOccurrence(occId: string): Promise<void>;
  getLinkedInvoiceIds(): Promise<string[]>;
  uploadOccurrenceDocument(occId: string, file: File): Promise<OccurrenceDTO>;
  deleteOccurrenceDocument(occId: string): Promise<void>;
}
