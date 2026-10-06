import type {
  CompanyDocument,
  CompanyDocumentCategory,
  CompanyDocumentUpload,
  DocumentCategoryScope,
} from "../../entities/company-document.ts";

export interface ListCompanyDocumentsPort {
  execute(): Promise<CompanyDocument[]>;
}

/** Valida localmente (formato, tamanho, datas) antes de qualquer pedido — lança `InvalidCompanyDocumentError`. */
export interface UploadCompanyDocumentPort {
  execute(upload: CompanyDocumentUpload & { category: string }): Promise<CompanyDocument>;
}

/** Renovação: nova versão "Atual"; a anterior fica "Substituída". */
export interface ReplaceCompanyDocumentPort {
  execute(documentId: string, upload: CompanyDocumentUpload): Promise<CompanyDocument>;
}

export interface RemoveCompanyDocumentPort {
  execute(documentId: string): Promise<void>;
}

export interface GetCompanyDocumentDownloadUrlPort {
  execute(documentId: string): Promise<string>;
}

export interface GetCompanyDocumentHistoryPort {
  execute(documentId: string): Promise<CompanyDocument[]>;
}

export interface ListCompanyDocumentCategoriesPort {
  execute(): Promise<CompanyDocumentCategory[]>;
}

export interface CreateCompanyDocumentCategoryPort {
  execute(label: string, scope: Extract<DocumentCategoryScope, "company" | "both">): Promise<CompanyDocumentCategory>;
}

export interface SetCompanyDocumentCategoryActivePort {
  execute(id: string, active: boolean): Promise<CompanyDocumentCategory>;
}
