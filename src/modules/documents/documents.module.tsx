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
import { HttpEmployeeDocumentsApiAdapter } from "./adapters/out/http-employee-documents-api.adapter.ts";
import { EmployeeDocumentsUseCases } from "./application/use-cases/employee-documents.use-cases.ts";
import type { EmployeeDocumentsPort } from "./domain/ports/in/employee-documents.ports.ts";

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

// eslint-disable-next-line react-refresh/only-export-components
export function useDocumentsModule(): DocumentsModule {
  const ctx = useContext(DocumentsContext);
  if (!ctx) throw new Error("useDocumentsModule must be used inside DocumentsProvider");
  return ctx;
}

// ── Documentos de colaborador (ficha do Novo RH) e importação de recibos ──
// ADR-0040, fase 1: saíram do módulo `hr`. Nos testes passa-se `module` com um fake.

const EmployeeDocumentsContext = createContext<EmployeeDocumentsPort | null>(null);

export function EmployeeDocumentsProvider({ children, module: mod }: { children: ReactNode; module?: EmployeeDocumentsPort }) {
  const value = mod ?? new EmployeeDocumentsUseCases(new HttpEmployeeDocumentsApiAdapter());
  return <EmployeeDocumentsContext.Provider value={value}>{children}</EmployeeDocumentsContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useEmployeeDocuments(): EmployeeDocumentsPort {
  const ctx = useContext(EmployeeDocumentsContext);
  if (!ctx) throw new Error("useEmployeeDocuments must be used inside EmployeeDocumentsProvider");
  return ctx;
}
