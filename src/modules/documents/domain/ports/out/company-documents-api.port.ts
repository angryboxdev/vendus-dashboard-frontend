import type {
  CompanyDocument,
  CompanyDocumentCategory,
  CompanyDocumentUpload,
  DocumentCategoryScope,
} from "../../entities/company-document.ts";

/** Contrato com `/api/company-documents` e `/api/document-categories?ownerType=company`. */
export interface CompanyDocumentsApiPort {
  listDocuments(): Promise<CompanyDocument[]>;
  uploadDocument(upload: CompanyDocumentUpload & { category: string }): Promise<CompanyDocument>;
  replaceDocument(documentId: string, upload: CompanyDocumentUpload): Promise<CompanyDocument>;
  removeDocument(documentId: string): Promise<void>;
  getDownloadUrl(documentId: string): Promise<string>;
  getHistory(documentId: string): Promise<CompanyDocument[]>;
  /** Categorias aplicáveis à Empresa (âmbito Empresa ou Ambos). */
  listCategories(): Promise<CompanyDocumentCategory[]>;
  createCategory(label: string, scope: Extract<DocumentCategoryScope, "company" | "both">): Promise<CompanyDocumentCategory>;
  setCategoryActive(id: string, active: boolean): Promise<CompanyDocumentCategory>;
}
