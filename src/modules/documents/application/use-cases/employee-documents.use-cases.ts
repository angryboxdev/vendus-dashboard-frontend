import type { ReplaceDocumentPayload, UploadDocumentPayload } from "../../domain/entities/employee-document.ts";
import type { PayslipCategory, PayslipMappingEntry } from "../../domain/entities/payslip-import.ts";
import type { EmployeeDocumentsPort } from "../../domain/ports/in/employee-documents.ports.ts";
import type { EmployeeDocumentsApiPort } from "../../domain/ports/out/employee-documents-api.port.ts";

/** Documentos de colaborador: delega no backend (ADR-0040, fase 1 — saiu do módulo `hr`). */
export class EmployeeDocumentsUseCases implements EmployeeDocumentsPort {
  private readonly api: EmployeeDocumentsApiPort;
  constructor(api: EmployeeDocumentsApiPort) {
    this.api = api;
  }
  listEmployeeDocuments(employeeId: string) {
    return this.api.listEmployeeDocuments(employeeId);
  }
  getDocumentSummary(employeeId: string) {
    return this.api.getDocumentSummary(employeeId);
  }
  uploadEmployeeDocument(employeeId: string, payload: UploadDocumentPayload) {
    return this.api.uploadEmployeeDocument(employeeId, payload);
  }
  replaceEmployeeDocument(employeeId: string, documentId: string, payload: ReplaceDocumentPayload) {
    return this.api.replaceEmployeeDocument(employeeId, documentId, payload);
  }
  removeEmployeeDocument(employeeId: string, documentId: string) {
    return this.api.removeEmployeeDocument(employeeId, documentId);
  }
  getEmployeeDocumentDownloadUrl(employeeId: string, documentId: string) {
    return this.api.getEmployeeDocumentDownloadUrl(employeeId, documentId);
  }
  getEmployeeDocumentHistory(employeeId: string, documentId: string) {
    return this.api.getEmployeeDocumentHistory(employeeId, documentId);
  }
  listDocumentCategories() {
    return this.api.listDocumentCategories();
  }
  listEmployees() {
    return this.api.listEmployees();
  }
  previewPayslipImport(category: PayslipCategory, period: string, files: File[]) {
    return this.api.previewPayslipImport(category, period, files);
  }
  importPayslips(category: PayslipCategory, period: string, files: File[], mapping: PayslipMappingEntry[]) {
    return this.api.importPayslips(category, period, files, mapping);
  }
}
