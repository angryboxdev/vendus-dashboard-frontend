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
 * As 3 categorias de identificação são as únicas que continuam fixas no
 * código (espelham `IDENTIFICATION_DOCUMENT_CATEGORIES` do backend,
 * `src/modules/hr/domain/services/document-status.service.ts`) — decisão
 * confirmada com o utilizador: o requisito "Documento de identificação"
 * (cumprido por qualquer uma das 3) fica fora da tela "Categorias de
 * documentos". Todas as outras categorias são configuráveis por
 * organização — ver `api.listDocumentCategories()`.
 */
export const DOCUMENT_CATEGORY_LABELS: Record<string, string> = {
  cartao_cidadao: "Cartão de Cidadão",
  titulo_residencia: "Título de Residência",
  passaporte: "Passaporte",
  outro: "Outro",
};

export const IDENTIFICATION_DOCUMENT_CATEGORIES = ["cartao_cidadao", "titulo_residencia", "passaporte"] as const;

/**
 * O único requisito "ou" que continua fixo — cumprido por qualquer uma das
 * 3 categorias de identificação. Usado para esconder do seletor "nova
 * categoria" as categorias-irmãs já satisfeitas (ex: se já há Cartão de
 * Cidadão, não sugerir também Título de Residência/Passaporte).
 */
export const MANDATORY_REQUIREMENT_GROUPS: readonly (readonly string[])[] = [
  ["cartao_cidadao", "titulo_residencia", "passaporte"],
];

/** Sugestões de que ficheiro serve para cada categoria — ajuda quem vai anexar a escolher o documento certo. */
export const DOCUMENT_UPLOAD_HINTS: Record<string, string[]> = {
  certificado_morada: ["Fatura de luz em seu nome", "Fatura de água", "Comprovativo das Finanças"],
  contrato_trabalho: ["Contrato de trabalho assinado por ambas as partes"],
  cartao_cidadao: ["Cartão de Cidadão (frente e verso)"],
  titulo_residencia: ["Título de Residência válido (frente e verso)"],
  passaporte: ["Passaporte válido (página de identificação)"],
  comprovativo_iban: ["Comprovativo de IBAN emitido pelo banco", "Extrato bancário com o IBAN visível"],
  apolice_seguro_at: ["Apólice de seguro de acidentes de trabalho em nome do colaborador"],
  ficha_colaborador: ["Ficha de dados do colaborador preenchida"],
  formacao_seguranca: ["Certificado de formação de segurança no trabalho"],
  atestado_saude: ["Atestado de aptidão médica para o trabalho"],
  nif: ["Cartão de Contribuinte ou comprovativo de NIF das Finanças"],
};

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
