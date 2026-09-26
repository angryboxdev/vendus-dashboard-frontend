export type DocumentOrigin = "rh" | "colaborador" | "sistema";
export type DocumentDisplayStatus = "ok" | "expiring" | "expired" | "pending_validation" | "rejected" | "removed";

export interface EmployeeDocument {
  id: string;
  employeeId: string;
  category: string;
  mandatory: boolean;
  fileName: string;
  mimeType: string | null;
  fileSizeBytes: number | null;
  origin: DocumentOrigin;
  expiresAt: string | null;
  version: number;
  previousVersionId: string | null;
  displayStatus: DocumentDisplayStatus;
  uploadedBy: string;
  uploadedAt: string;
}

export interface UploadDocumentPayload {
  category: string;
  mandatory: boolean;
  origin: DocumentOrigin;
  expiresAt: string | null;
  file: File;
}

export interface ReplaceDocumentPayload {
  expiresAt?: string | null;
  file: File;
}

/**
 * Categorias por omissão — espelham `DEFAULT_MANDATORY_CATEGORIES` do
 * backend (`src/modules/hr/domain/services/document-status.service.ts`).
 * Não configurável por organização nesta fase (dívida conhecida, ver README).
 */
export const DOCUMENT_CATEGORY_LABELS: Record<string, string> = {
  contrato_trabalho: "Contrato de trabalho",
  cartao_cidadao: "Cartão de Cidadão",
  nif: "NIF",
  certificado_morada: "Certificado de morada",
  ficha_colaborador: "Ficha de colaborador",
  comprovativo_iban: "Comprovativo IBAN",
  formacao_seguranca: "Formação de segurança",
  atestado_saude: "Atestado de saúde",
  outro: "Outro",
};

export const DEFAULT_MANDATORY_CATEGORIES = [
  "contrato_trabalho",
  "cartao_cidadao",
  "nif",
  "certificado_morada",
  "ficha_colaborador",
  "comprovativo_iban",
  "formacao_seguranca",
  "atestado_saude",
] as const;

export const DOCUMENT_ORIGIN_LABELS: Record<DocumentOrigin, string> = {
  rh: "RH",
  colaborador: "Colaborador",
  sistema: "Sistema",
};

export const DOCUMENT_STATUS_LABELS: Record<DocumentDisplayStatus, { label: string; cls: string; dot: string }> = {
  ok: { label: "Tudo ok", cls: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" },
  expiring: { label: "A expirar", cls: "bg-amber-50 text-amber-700", dot: "bg-amber-500" },
  expired: { label: "Expirado", cls: "bg-red-50 text-red-600", dot: "bg-red-500" },
  pending_validation: { label: "A validar", cls: "bg-violet-50 text-violet-600", dot: "bg-violet-500" },
  rejected: { label: "Rejeitado", cls: "bg-red-50 text-red-600", dot: "bg-red-500" },
  removed: { label: "Removido", cls: "bg-stone-100 text-stone-500", dot: "bg-stone-400" },
};
