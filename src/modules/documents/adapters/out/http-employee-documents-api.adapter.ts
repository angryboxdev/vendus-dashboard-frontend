import { apiDeleteNoContent, apiGet, apiPostFormData } from "../../../../lib/api.ts";
import type { DocumentCategoryDefinition } from "../../domain/entities/document-category.ts";
import type { EmployeeDocument, ReplaceDocumentPayload, UploadDocumentPayload } from "../../domain/entities/employee-document.ts";
import type { EmployeeDocumentSummary } from "../../domain/entities/employee-document-summary.ts";
import type { PayslipCategory, PayslipImportResult, PayslipMappingEntry, PayslipPreviewRow } from "../../domain/entities/payslip-import.ts";
import type { EmployeeDocumentsApiPort } from "../../domain/ports/out/employee-documents-api.port.ts";

const PEOPLE = "/api/novo-rh/people";
const doc = (employeeId: string, documentId?: string) =>
  `${PEOPLE}/${encodeURIComponent(employeeId)}/documents${documentId ? `/${encodeURIComponent(documentId)}` : ""}`;

/** Rotas do Novo RH (ADR-0040, fase 1): em modo Demonstração seguem para a organização de demonstração. */
export class HttpEmployeeDocumentsApiAdapter implements EmployeeDocumentsApiPort {
  listEmployeeDocuments(employeeId: string) {
    return apiGet<EmployeeDocument[]>(doc(employeeId));
  }
  getDocumentSummary(employeeId: string) {
    return apiGet<EmployeeDocumentSummary>(`${doc(employeeId)}/summary`);
  }
  uploadEmployeeDocument(employeeId: string, payload: UploadDocumentPayload) {
    const form = new FormData();
    form.append("file", payload.file);
    form.append("category", payload.category);
    form.append("mandatory", String(payload.mandatory));
    form.append("origin", payload.origin);
    if (payload.expiresAt) form.append("expiresAt", payload.expiresAt);
    if (payload.period) form.append("period", payload.period);
    return apiPostFormData<EmployeeDocument>(doc(employeeId), form);
  }
  replaceEmployeeDocument(employeeId: string, documentId: string, payload: ReplaceDocumentPayload) {
    const form = new FormData();
    form.append("file", payload.file);
    if (payload.expiresAt !== undefined) form.append("expiresAt", payload.expiresAt ?? "");
    return apiPostFormData<EmployeeDocument>(`${doc(employeeId, documentId)}/replace`, form);
  }
  removeEmployeeDocument(employeeId: string, documentId: string) {
    return apiDeleteNoContent(doc(employeeId, documentId));
  }
  async getEmployeeDocumentDownloadUrl(employeeId: string, documentId: string) {
    return (await apiGet<{ url: string }>(`${doc(employeeId, documentId)}/download-url`)).url;
  }
  getEmployeeDocumentHistory(employeeId: string, documentId: string) {
    return apiGet<EmployeeDocument[]>(`${doc(employeeId, documentId)}/history`);
  }
  listDocumentCategories() {
    return apiGet<DocumentCategoryDefinition[]>("/api/document-categories");
  }
  async listEmployees() {
    const people = await apiGet<Array<{ id: string; fullName: string }>>(`${PEOPLE}?status=all`);
    return people.map((p) => ({ id: p.id, fullName: p.fullName }));
  }
  previewPayslipImport(category: PayslipCategory, period: string, files: File[]) {
    const form = new FormData();
    form.append("category", category);
    form.append("period", period);
    for (const f of files) form.append("files", f);
    return apiPostFormData<PayslipPreviewRow[]>("/api/novo-rh/payslips/import/preview", form);
  }
  importPayslips(category: PayslipCategory, period: string, files: File[], mapping: PayslipMappingEntry[]) {
    const form = new FormData();
    form.append("category", category);
    form.append("period", period);
    form.append("mapping", JSON.stringify(mapping));
    const wanted = new Set(mapping.map((m) => m.fileName));
    for (const f of files) if (wanted.has(f.name)) form.append("files", f);
    return apiPostFormData<PayslipImportResult[]>("/api/novo-rh/payslips/import", form);
  }
}
