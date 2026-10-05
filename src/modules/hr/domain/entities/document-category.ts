import type { JobRole } from "./employee.ts";

/**
 * Âmbito da categoria (Base Organizacional): Colaborador, Empresa ou Ambos.
 * Uma categoria só da Empresa nunca entra nos requisitos dos colaboradores.
 */
export type DocumentCategoryScope = "employee" | "company" | "both";

export const DOCUMENT_CATEGORY_SCOPE_LABELS: Record<DocumentCategoryScope, string> = {
  employee: "Colaborador",
  company: "Empresa",
  both: "Ambos",
};

export interface DocumentCategoryDefinition {
  id: string;
  slug: string;
  label: string;
  mandatory: boolean;
  /** Vazio = aplica-se a todos os cargos. */
  jobRoles: JobRole[];
  acceptedMimeTypes: string[];
  scope: DocumentCategoryScope;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentCategoryPayload {
  label: string;
  mandatory: boolean;
  jobRoles: JobRole[];
  acceptedMimeTypes: string[];
  scope: DocumentCategoryScope;
}

export const ACCEPTED_MIME_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "application/pdf", label: "PDF" },
  { value: "image/jpeg", label: "JPG" },
  { value: "image/png", label: "PNG" },
];
