/**
 * Pastas da ficha (Documentos): agrupam as categorias só para navegar — a
 * categoria continua a ser a fonte (requisitos, validade, upload). Categorias
 * periódicas (recibos) vão para «Recibos e faturas»; categorias novas criadas
 * pela empresa e «Outro» caem em «Outros».
 */
export type DocumentFolder = "personal" | "work" | "payslips" | "health" | "other";

export const DOCUMENT_FOLDERS: { key: DocumentFolder; label: string; hint: string }[] = [
  { key: "personal", label: "Documentos pessoais", hint: "Identificação, NIF, morada e IBAN" },
  { key: "work", label: "Contrato e trabalho", hint: "Contrato, ficha e seguro" },
  { key: "payslips", label: "Recibos e faturas", hint: "Recibos de vencimento por mês" },
  { key: "health", label: "Saúde e formação", hint: "Atestados e formações" },
  { key: "other", label: "Outros", hint: "Restantes documentos" },
];

const BY_SLUG: Record<string, DocumentFolder> = {
  cartao_cidadao: "personal",
  titulo_residencia: "personal",
  passaporte: "personal",
  nif: "personal",
  certificado_morada: "personal",
  comprovativo_iban: "personal",
  contrato_trabalho: "work",
  ficha_colaborador: "work",
  apolice_seguro_at: "work",
  recibo_vencimento: "payslips",
  recibo_verde: "payslips",
  atestado_saude: "health",
  formacao_seguranca: "health",
};

export function documentFolderOf(category: string, requiresPeriod = false): DocumentFolder {
  if (requiresPeriod) return "payslips";
  return BY_SLUG[category] ?? "other";
}
