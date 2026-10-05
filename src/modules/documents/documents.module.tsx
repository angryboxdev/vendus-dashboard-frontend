import { createContext, useContext, type ReactNode } from "react";
import { HttpCompanyDocumentsApiAdapter } from "./adapters/out/http-company-documents-api.adapter.ts";
import {
  CreateCompanyDocumentCategoryUseCase,
  GetCompanyDocumentDownloadUrlUseCase,
  GetCompanyDocumentHistoryUseCase,
  ListCompanyDocumentCategoriesUseCase,
  ListCompanyDocumentsUseCase,
  RemoveCompanyDocumentUseCase,
  ReplaceCompanyDocumentUseCase,
  SetCompanyDocumentCategoryActiveUseCase,
  UploadCompanyDocumentUseCase,
} from "./application/use-cases/company-documents.use-cases.ts";
import type {
  CreateCompanyDocumentCategoryPort,
  GetCompanyDocumentDownloadUrlPort,
  GetCompanyDocumentHistoryPort,
  ListCompanyDocumentCategoriesPort,
  ListCompanyDocumentsPort,
  RemoveCompanyDocumentPort,
  ReplaceCompanyDocumentPort,
  SetCompanyDocumentCategoryActivePort,
  UploadCompanyDocumentPort,
} from "./domain/ports/in/company-documents.ports.ts";
import type { CompanyDocumentsApiPort } from "./domain/ports/out/company-documents-api.port.ts";

export interface DocumentsModule {
  listDocuments: ListCompanyDocumentsPort;
  uploadDocument: UploadCompanyDocumentPort;
  replaceDocument: ReplaceCompanyDocumentPort;
  removeDocument: RemoveCompanyDocumentPort;
  getDownloadUrl: GetCompanyDocumentDownloadUrlPort;
  getHistory: GetCompanyDocumentHistoryPort;
  listCategories: ListCompanyDocumentCategoriesPort;
  createCategory: CreateCompanyDocumentCategoryPort;
  setCategoryActive: SetCompanyDocumentCategoryActivePort;
}

/**
 * Composition root — único sítio que conhece o adapter concreto. Nos testes
 * monta-se o `DocumentsModule` com `InMemoryCompanyDocumentsApiAdapter` e
 * passa-se por `module` ao provider (mesmo padrão de `tasks`).
 */
function buildModule(api: CompanyDocumentsApiPort = new HttpCompanyDocumentsApiAdapter()): DocumentsModule {
  return {
    listDocuments: new ListCompanyDocumentsUseCase(api),
    uploadDocument: new UploadCompanyDocumentUseCase(api),
    replaceDocument: new ReplaceCompanyDocumentUseCase(api),
    removeDocument: new RemoveCompanyDocumentUseCase(api),
    getDownloadUrl: new GetCompanyDocumentDownloadUrlUseCase(api),
    getHistory: new GetCompanyDocumentHistoryUseCase(api),
    listCategories: new ListCompanyDocumentCategoriesUseCase(api),
    createCategory: new CreateCompanyDocumentCategoryUseCase(api),
    setCategoryActive: new SetCompanyDocumentCategoryActiveUseCase(api),
  };
}

const DocumentsContext = createContext<DocumentsModule | null>(null);

export function DocumentsProvider({ children, module: mod }: { children: ReactNode; module?: DocumentsModule }) {
  const value = mod ?? buildModule();
  return <DocumentsContext.Provider value={value}>{children}</DocumentsContext.Provider>;
}

export function useDocumentsModule(): DocumentsModule {
  const ctx = useContext(DocumentsContext);
  if (!ctx) throw new Error("useDocumentsModule must be used inside DocumentsProvider");
  return ctx;
}
