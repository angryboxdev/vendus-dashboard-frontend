import type {
  AccountingDocumentDTO,
  AccountingDocumentRowDTO,
  CreateAccountingDocumentPayload,
  UpdateAccountingDocumentPayload,
  ListAccountingDocumentsParams,
} from "../../entities/accounting-document.ts";
import type { VatOverviewResult } from "../../entities/vat-overview.ts";
import type { AccountingSettings, UpdateAccountingSettingsPayload } from "../../entities/accounting-settings.ts";

export interface AccountingApiPort {
  listAccountingDocuments(params?: ListAccountingDocumentsParams): Promise<AccountingDocumentRowDTO[]>;
  getAccountingDocument(id: string): Promise<AccountingDocumentDTO>;
  /** Pode rejeitar com `AccountingDuplicateError` (409) — reenviar com `payload.confirmDuplicate = true` para forçar. */
  createAccountingDocument(payload: CreateAccountingDocumentPayload): Promise<AccountingDocumentDTO>;
  updateAccountingDocument(id: string, payload: UpdateAccountingDocumentPayload): Promise<AccountingDocumentDTO>;
  validateAccountingDocument(id: string): Promise<AccountingDocumentDTO>;
  markAccountingDocumentPendency(id: string): Promise<AccountingDocumentDTO>;
  cancelAccountingDocument(id: string, reason: string): Promise<AccountingDocumentDTO>;
  /** Cada upload adiciona uma nova versão ao anexo — nunca substitui a anterior. */
  uploadAccountingDocumentAttachment(id: string, file: File): Promise<AccountingDocumentDTO>;

  getVatOverview(year: number, period: number): Promise<VatOverviewResult>;

  getAccountingSettings(): Promise<AccountingSettings>;
  updateAccountingSettings(payload: UpdateAccountingSettingsPayload): Promise<AccountingSettings>;
}
