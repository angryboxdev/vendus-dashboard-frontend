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

export interface FolderPerson {
  employeeId: string;
  employeeName: string;
  count: number;
  lastUploadedAt: string;
}

/** Pasta → colaboradores com documentos nela (quantidade e último arquivamento), por nome. */
export function archiveByFolder(rows: { employeeId: string; employeeName: string; category: string; requiresPeriod: boolean; count: number; lastUploadedAt: string }[]): Record<DocumentFolder, FolderPerson[]> {
  const out = Object.fromEntries(DOCUMENT_FOLDERS.map((f) => [f.key, new Map<string, FolderPerson>()])) as Record<DocumentFolder, Map<string, FolderPerson>>;
  for (const r of rows) {
    const people = out[documentFolderOf(r.category, r.requiresPeriod)];
    const cur = people.get(r.employeeId) ?? { employeeId: r.employeeId, employeeName: r.employeeName, count: 0, lastUploadedAt: r.lastUploadedAt };
    cur.count += r.count;
    if (r.lastUploadedAt > cur.lastUploadedAt) cur.lastUploadedAt = r.lastUploadedAt;
    people.set(r.employeeId, cur);
  }
  return Object.fromEntries(
    Object.entries(out).map(([k, m]) => [k, [...m.values()].sort((a, b) => a.employeeName.localeCompare(b.employeeName, "pt"))]),
  ) as Record<DocumentFolder, FolderPerson[]>;
}
