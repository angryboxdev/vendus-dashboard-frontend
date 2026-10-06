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
  /** Cargos a que se aplica ("Cargos selecionados"); vazio = todos os colaboradores. */
  positionIds: string[];
  acceptedMimeTypes: string[];
  scope: DocumentCategoryScope;
  /** Categoria periódica (ex: Recibo de vencimento): o upload pede o período Mês/Ano; nunca fica "Em falta". Definida pelo backend. */
  requiresPeriod: boolean;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentCategoryPayload {
  label: string;
  mandatory: boolean;
  positionIds: string[];
  acceptedMimeTypes: string[];
  scope: DocumentCategoryScope;
}

export const ACCEPTED_MIME_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "application/pdf", label: "PDF" },
  { value: "image/jpeg", label: "JPG" },
  { value: "image/png", label: "PNG" },
];
