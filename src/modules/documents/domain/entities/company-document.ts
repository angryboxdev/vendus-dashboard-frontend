/** D11 — Gestão (gestores e administradores) ou Só administração. */
export type DocumentVisibility = "management" | "admin";

export type DocumentDisplayStatus = "ok" | "expiring" | "expired" | "pending_validation" | "rejected" | "removed";

/** Âmbito da categoria — a mesma fonte de categorias dos documentos dos Colaboradores. */
export type DocumentCategoryScope = "employee" | "company" | "both";

/** Espelho de `CompanyDocumentDTO` (backend, módulo `documents`). */
export interface CompanyDocument {
  id: string;
  category: string;
  categoryLabel: string;
  fileName: string;
  mimeType: string | null;
  fileSizeBytes: number | null;
  issuedAt: string | null;
  expiresAt: string | null;
  visibility: DocumentVisibility;
  displayStatus: DocumentDisplayStatus;
  version: number;
  /** `false` = versão "Substituída". */
  isCurrent: boolean;
  uploadedBy: string;
  uploadedAt: string;
}

export interface CompanyDocumentCategory {
  id: string;
  slug: string;
  label: string;
  scope: DocumentCategoryScope;
  acceptedMimeTypes: string[];
  active: boolean;
}

export interface CompanyDocumentUpload {
  /** Só no envio da primeira versão; ao renovar a categoria é a do documento. */
  category?: string;
  file: File;
  issuedAt: string | null;
  expiresAt: string | null;
  visibility: DocumentVisibility;
}

export const VISIBILITY_LABELS: Record<DocumentVisibility, string> = {
  management: "Gestão",
  admin: "Só administração",
};

export const DISPLAY_STATUS_LABELS: Record<DocumentDisplayStatus, string> = {
  ok: "Válido",
  expiring: "A expirar",
  expired: "Expirado",
  pending_validation: "A validar",
  rejected: "Rejeitado",
  removed: "Removido",
};

export const SCOPE_LABELS: Record<DocumentCategoryScope, string> = {
  employee: "Colaborador",
  company: "Empresa",
  both: "Ambos",
};

/** Validação local antes de enviar — mesmos limites do backend. */
export class InvalidCompanyDocumentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidCompanyDocumentError";
  }
}
