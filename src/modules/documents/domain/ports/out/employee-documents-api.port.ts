import type { DocumentCategoryDefinition } from "../../entities/document-category.ts";
import type { DocumentArchiveRow, EmployeeDocument, ReplaceDocumentPayload, UploadDocumentPayload } from "../../entities/employee-document.ts";
import type { EmployeeDocumentSummary } from "../../entities/employee-document-summary.ts";
import type { PayslipCategory, PayslipImportResult, PayslipMappingEntry, PayslipPreviewRow } from "../../entities/payslip-import.ts";

/** Documentos de colaborador e importação de recibos (backend: `/api/novo-rh/people/:id/documents*`, `/api/novo-rh/payslips/*`). */
export interface EmployeeDocumentsApiPort {
  listEmployeeDocuments(employeeId: string): Promise<EmployeeDocument[]>;
  getDocumentSummary(employeeId: string): Promise<EmployeeDocumentSummary>;
  uploadEmployeeDocument(employeeId: string, payload: UploadDocumentPayload): Promise<EmployeeDocument>;
  replaceEmployeeDocument(employeeId: string, documentId: string, payload: ReplaceDocumentPayload): Promise<EmployeeDocument>;
  removeEmployeeDocument(employeeId: string, documentId: string): Promise<void>;
  getEmployeeDocumentDownloadUrl(employeeId: string, documentId: string): Promise<string>;
  getEmployeeDocumentHistory(employeeId: string, documentId: string): Promise<EmployeeDocument[]>;
  listDocumentCategories(): Promise<DocumentCategoryDefinition[]>;
  /** Arquivo por pastas: contagem e último arquivamento por colaborador × categoria. */
  getDocumentArchive(): Promise<DocumentArchiveRow[]>;
  /** Colaboradores (todos) para associar recibos na importação. */
  listEmployees(): Promise<Array<{ id: string; fullName: string }>>;
  previewPayslipImport(category: PayslipCategory, period: string, files: File[]): Promise<PayslipPreviewRow[]>;
  importPayslips(category: PayslipCategory, period: string, files: File[], mapping: PayslipMappingEntry[]): Promise<PayslipImportResult[]>;
}
