import { DOCUMENT_FOLDERS, documentFolderOf, type DocumentFolder } from "../../../documents/domain/services/document-folders.service.ts";
import type { DocumentChecklist, MyDocument, SubmittableCategory } from "../entities/portal.ts";

/**
 * Pastas do Portal = as mesmas pastas da ficha do RH (Documentos pessoais,
 * Contrato e trabalho, Recibos e faturas, Saúde e formação, Outros — função
 * pura partilhada do módulo `documents`). A categoria continua a ser a fonte;
 * cada documento fica numa só pasta.
 */
export interface PortalFolder {
  key: DocumentFolder;
  label: string;
  hint: string;
  docs: MyDocument[];
  /** Categorias desta pasta para onde pode enviar agora. */
  submittable: SubmittableCategory[];
  /** Categorias sem documento (as obrigatórias primeiro). */
  missing: SubmittableCategory[];
  /** Quantas coisas pedem ação: obrigatórios em falta/vencidos, documentos a substituir ou rejeitados. */
  attention: number;
}

/** Precisa de ação do colaborador: pode substituir (vencido/a vencer) ou o último envio foi rejeitado. */
export const needsAttention = (d: MyDocument) => d.status !== "pending_validation" && (d.canReplace || d.lastRejection !== null);

export const folderOfDocument = (d: Pick<MyDocument, "category" | "isPayslip">): DocumentFolder => documentFolderOf(d.category ?? "", d.isPayslip);
export const folderOfCategory = (c: Pick<SubmittableCategory, "slug" | "requiresPeriod">): DocumentFolder => documentFolderOf(c.slug, c.requiresPeriod);

export function portalFolders(docs: MyDocument[], checklist: DocumentChecklist | null): PortalFolder[] {
  const cats = checklist?.categories ?? [];
  const missingMandatory = checklist?.missingMandatory ?? [];
  return DOCUMENT_FOLDERS.map((f) => {
    const inFolder = docs.filter((d) => folderOfDocument(d) === f.key);
    const folderCats = cats.filter((c) => folderOfCategory(c) === f.key);
    // Um obrigatório vencido já conta pelo próprio documento (substituir); só os em falta somam à parte.
    const requiredMissing = missingMandatory.filter((m) => m.status === "missing" && m.categories.some((slug) => documentFolderOf(slug) === f.key)).length;
    return {
      key: f.key,
      label: f.label,
      hint: f.hint,
      docs: inFolder,
      submittable: folderCats.filter((c) => c.canSubmit),
      missing: folderCats.filter((c) => c.status === "missing").sort((a, b) => Number(b.mandatory) - Number(a.mandatory) || a.label.localeCompare(b.label, "pt")),
      attention: inFolder.filter(needsAttention).length + requiredMissing,
    };
  });
}

/** "PDF", "Imagem" ou "Ficheiro" — pelo tipo guardado ou, em documentos antigos, pela extensão. */
export function fileKind(d: Pick<MyDocument, "mimeType" | "fileName">): "PDF" | "Imagem" | "Ficheiro" {
  const mime = d.mimeType ?? "";
  if (mime === "application/pdf" || /\.pdf$/i.test(d.fileName)) return "PDF";
  if (mime.startsWith("image/") || /\.(jpe?g|png|heic|webp)$/i.test(d.fileName)) return "Imagem";
  return "Ficheiro";
}

/** Limite do servidor para envios do Portal. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/** Valida o ficheiro antes de enviar (o servidor volta a validar). `null` = pode enviar. */
export function uploadProblem(file: Pick<File, "size" | "type">, accepts: string[]): string | null {
  if (file.size > MAX_UPLOAD_BYTES) return "O ficheiro tem mais de 10 MB.";
  if (!accepts.includes(file.type)) return accepts.includes("image/jpeg") ? "Escolha um PDF ou uma foto (JPG/PNG)." : "Escolha um PDF.";
  return null;
}
