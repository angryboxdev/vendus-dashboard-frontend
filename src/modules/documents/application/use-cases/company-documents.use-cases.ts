import {
  InvalidCompanyDocumentError,
  type CompanyDocument,
  type CompanyDocumentCategory,
  type CompanyDocumentUpload,
  type DocumentCategoryScope,
} from "../../domain/entities/company-document.ts";
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
} from "../../domain/ports/in/company-documents.ports.ts";
import type { CompanyDocumentsApiPort } from "../../domain/ports/out/company-documents-api.port.ts";
import { validateCompanyDocumentUpload } from "../../domain/services/company-document.service.ts";

function assertValid(upload: CompanyDocumentUpload): void {
  const error = validateCompanyDocumentUpload(upload);
  if (error) throw new InvalidCompanyDocumentError(error);
}

export class ListCompanyDocumentsUseCase implements ListCompanyDocumentsPort {
  private readonly api: CompanyDocumentsApiPort;
  constructor(api: CompanyDocumentsApiPort) {
    this.api = api;
  }
  execute(): Promise<CompanyDocument[]> {
    return this.api.listDocuments();
  }
}

export class UploadCompanyDocumentUseCase implements UploadCompanyDocumentPort {
  private readonly api: CompanyDocumentsApiPort;
  constructor(api: CompanyDocumentsApiPort) {
    this.api = api;
  }
  async execute(upload: CompanyDocumentUpload & { category: string }): Promise<CompanyDocument> {
    if (!upload.category) throw new InvalidCompanyDocumentError("Escolha uma categoria.");
    assertValid(upload);
    return this.api.uploadDocument(upload);
  }
}

export class ReplaceCompanyDocumentUseCase implements ReplaceCompanyDocumentPort {
  private readonly api: CompanyDocumentsApiPort;
  constructor(api: CompanyDocumentsApiPort) {
    this.api = api;
  }
  async execute(documentId: string, upload: CompanyDocumentUpload): Promise<CompanyDocument> {
    assertValid(upload);
    return this.api.replaceDocument(documentId, upload);
  }
}

export class RemoveCompanyDocumentUseCase implements RemoveCompanyDocumentPort {
  private readonly api: CompanyDocumentsApiPort;
  constructor(api: CompanyDocumentsApiPort) {
    this.api = api;
  }
  execute(documentId: string): Promise<void> {
    return this.api.removeDocument(documentId);
  }
}

export class GetCompanyDocumentDownloadUrlUseCase implements GetCompanyDocumentDownloadUrlPort {
  private readonly api: CompanyDocumentsApiPort;
  constructor(api: CompanyDocumentsApiPort) {
    this.api = api;
  }
  execute(documentId: string): Promise<string> {
    return this.api.getDownloadUrl(documentId);
  }
}

export class GetCompanyDocumentHistoryUseCase implements GetCompanyDocumentHistoryPort {
  private readonly api: CompanyDocumentsApiPort;
  constructor(api: CompanyDocumentsApiPort) {
    this.api = api;
  }
  execute(documentId: string): Promise<CompanyDocument[]> {
    return this.api.getHistory(documentId);
  }
}

export class ListCompanyDocumentCategoriesUseCase implements ListCompanyDocumentCategoriesPort {
  private readonly api: CompanyDocumentsApiPort;
  constructor(api: CompanyDocumentsApiPort) {
    this.api = api;
  }
  execute(): Promise<CompanyDocumentCategory[]> {
    return this.api.listCategories();
  }
}

export class CreateCompanyDocumentCategoryUseCase implements CreateCompanyDocumentCategoryPort {
  private readonly api: CompanyDocumentsApiPort;
  constructor(api: CompanyDocumentsApiPort) {
    this.api = api;
  }
  async execute(label: string, scope: Extract<DocumentCategoryScope, "company" | "both">): Promise<CompanyDocumentCategory> {
    if (label.trim().length === 0) throw new InvalidCompanyDocumentError("Indique o nome da categoria.");
    return this.api.createCategory(label.trim(), scope);
  }
}

export class SetCompanyDocumentCategoryActiveUseCase implements SetCompanyDocumentCategoryActivePort {
  private readonly api: CompanyDocumentsApiPort;
  constructor(api: CompanyDocumentsApiPort) {
    this.api = api;
  }
  execute(id: string, active: boolean): Promise<CompanyDocumentCategory> {
    return this.api.setCategoryActive(id, active);
  }
}
