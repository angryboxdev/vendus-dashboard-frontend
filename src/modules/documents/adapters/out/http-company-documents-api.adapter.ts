import { apiDeleteNoContent, apiGet, apiPatch, apiPost, apiPostFormData } from "../../../../lib/api.ts";
import type {
  CompanyDocument,
  CompanyDocumentCategory,
  CompanyDocumentUpload,
  DocumentCategoryScope,
} from "../../domain/entities/company-document.ts";
import type { CompanyDocumentsApiPort } from "../../domain/ports/out/company-documents-api.port.ts";

const BASE = "/api/company-documents";
const CATEGORIES = "/api/document-categories";

function toFormData(upload: CompanyDocumentUpload): FormData {
  const form = new FormData();
  form.append("file", upload.file);
  if (upload.category) form.append("category", upload.category);
  if (upload.issuedAt) form.append("issuedAt", upload.issuedAt);
  if (upload.expiresAt) form.append("expiresAt", upload.expiresAt);
  form.append("visibility", upload.visibility);
  return form;
}

export class HttpCompanyDocumentsApiAdapter implements CompanyDocumentsApiPort {
  listDocuments(): Promise<CompanyDocument[]> {
    return apiGet<CompanyDocument[]>(BASE);
  }

  uploadDocument(upload: CompanyDocumentUpload & { category: string }): Promise<CompanyDocument> {
    return apiPostFormData<CompanyDocument>(BASE, toFormData(upload));
  }

  replaceDocument(documentId: string, upload: CompanyDocumentUpload): Promise<CompanyDocument> {
    return apiPostFormData<CompanyDocument>(`${BASE}/${encodeURIComponent(documentId)}/replace`, toFormData(upload));
  }

  removeDocument(documentId: string): Promise<void> {
    return apiDeleteNoContent(`${BASE}/${encodeURIComponent(documentId)}`);
  }

  async getDownloadUrl(documentId: string): Promise<string> {
    const { url } = await apiGet<{ url: string }>(`${BASE}/${encodeURIComponent(documentId)}/download-url`);
    return url;
  }

  getHistory(documentId: string): Promise<CompanyDocument[]> {
    return apiGet<CompanyDocument[]>(`${BASE}/${encodeURIComponent(documentId)}/history`);
  }

  listCategories(): Promise<CompanyDocumentCategory[]> {
    return apiGet<CompanyDocumentCategory[]>(`${CATEGORIES}?ownerType=company`);
  }

  createCategory(label: string, scope: Extract<DocumentCategoryScope, "company" | "both">): Promise<CompanyDocumentCategory> {
    return apiPost<CompanyDocumentCategory>(CATEGORIES, { label, scope, mandatory: false });
  }

  setCategoryActive(id: string, active: boolean): Promise<CompanyDocumentCategory> {
    return apiPatch<CompanyDocumentCategory>(`${CATEGORIES}/${encodeURIComponent(id)}/active`, { active });
  }
}
