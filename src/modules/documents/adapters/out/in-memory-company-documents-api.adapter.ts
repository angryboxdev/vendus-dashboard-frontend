import { ApiError } from "../../../../lib/api.ts";
import type {
  CompanyDocument,
  CompanyDocumentCategory,
  CompanyDocumentUpload,
  DocumentCategoryScope,
} from "../../domain/entities/company-document.ts";
import type { CompanyDocumentsApiPort } from "../../domain/ports/out/company-documents-api.port.ts";

/**
 * Fake para testes — reproduz as regras do backend que a UI exercita:
 * 1 versão atual por categoria (409), renovar preserva a anterior como
 * substituída, remover é lógico. Dados fictícios.
 */
export class InMemoryCompanyDocumentsApiAdapter implements CompanyDocumentsApiPort {
  private documents: CompanyDocument[] = [];
  private categories: CompanyDocumentCategory[];
  private seq = 0;

  constructor(categories: CompanyDocumentCategory[] = []) {
    this.categories = [...categories];
  }

  private label(slug: string): string {
    return this.categories.find((c) => c.slug === slug)?.label ?? slug;
  }

  private build(upload: CompanyDocumentUpload, category: string, version: number): CompanyDocument {
    this.seq += 1;
    return {
      id: `doc-${this.seq}`,
      category,
      categoryLabel: this.label(category),
      fileName: upload.file.name,
      mimeType: upload.file.type,
      fileSizeBytes: upload.file.size,
      issuedAt: upload.issuedAt,
      expiresAt: upload.expiresAt,
      visibility: upload.visibility,
      displayStatus: "ok",
      version,
      isCurrent: true,
      uploadedBy: "admin@exemplo.pt",
      uploadedAt: new Date().toISOString(),
    };
  }

  async listDocuments(): Promise<CompanyDocument[]> {
    return this.documents.filter((d) => d.isCurrent);
  }

  async uploadDocument(upload: CompanyDocumentUpload & { category: string }): Promise<CompanyDocument> {
    if (this.documents.some((d) => d.isCurrent && d.category === upload.category)) {
      throw new ApiError("Já existe um documento atual nesta categoria — use Renovar", 409);
    }
    const doc = this.build(upload, upload.category, 1);
    this.documents.push(doc);
    return doc;
  }

  async replaceDocument(documentId: string, upload: CompanyDocumentUpload): Promise<CompanyDocument> {
    const previous = this.documents.find((d) => d.id === documentId)!;
    const next = this.build(upload, previous.category, previous.version + 1);
    this.documents = this.documents.map((d) => (d.id === documentId ? { ...d, isCurrent: false } : d));
    this.documents.push(next);
    return next;
  }

  async removeDocument(documentId: string): Promise<void> {
    this.documents = this.documents.map((d) => (d.id === documentId ? { ...d, isCurrent: false, displayStatus: "removed" } : d));
  }

  async getDownloadUrl(documentId: string): Promise<string> {
    return `memory://${documentId}`;
  }

  async getHistory(documentId: string): Promise<CompanyDocument[]> {
    const category = this.documents.find((d) => d.id === documentId)?.category;
    return this.documents.filter((d) => d.category === category && d.displayStatus !== "removed").sort((a, b) => b.version - a.version);
  }

  async listCategories(): Promise<CompanyDocumentCategory[]> {
    return this.categories;
  }

  async createCategory(label: string, scope: Extract<DocumentCategoryScope, "company" | "both">): Promise<CompanyDocumentCategory> {
    const category = { id: `cat-${this.categories.length + 1}`, slug: label.toLowerCase().replace(/\s+/g, "_"), label, scope, acceptedMimeTypes: [], active: true };
    this.categories.push(category);
    return category;
  }

  async setCategoryActive(id: string, active: boolean): Promise<CompanyDocumentCategory> {
    this.categories = this.categories.map((c) => (c.id === id ? { ...c, active } : c));
    return this.categories.find((c) => c.id === id)!;
  }
}
