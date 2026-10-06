import type { CompanyDocument, CompanyDocumentUpload, DocumentVisibility } from "../entities/company-document.ts";

export const DOCUMENT_ACCEPTED_TYPES = ["application/pdf", "image/jpeg", "image/png"];
export const DOCUMENT_MAX_BYTES = 20 * 1024 * 1024;

/** Mensagem de erro ou `null` se o envio é aceitável. */
export function validateCompanyDocumentUpload(upload: Pick<CompanyDocumentUpload, "file" | "issuedAt" | "expiresAt">): string | null {
  if (!DOCUMENT_ACCEPTED_TYPES.includes(upload.file.type)) return "Formato não suportado — use PDF, JPG ou PNG.";
  if (upload.file.size > DOCUMENT_MAX_BYTES) return "O ficheiro não pode ter mais de 20 MB.";
  if (upload.issuedAt && upload.expiresAt && upload.expiresAt < upload.issuedAt) {
    return "A data de validade não pode ser anterior à data de emissão.";
  }
  return null;
}

/** Só administradores podem escolher "Só administração" (o backend recusa o resto). */
export function visibilityOptionsFor(role: "admin" | "manager" | "hr_viewer" | undefined): DocumentVisibility[] {
  return role === "admin" ? ["management", "admin"] : ["management"];
}

const STATUS_ORDER: Record<CompanyDocument["displayStatus"], number> = {
  expired: 0,
  expiring: 1,
  pending_validation: 2,
  rejected: 3,
  ok: 4,
  removed: 5,
};

/** O que exige atenção primeiro (expirados, a expirar), depois por categoria. */
export function sortCompanyDocuments(documents: CompanyDocument[]): CompanyDocument[] {
  return [...documents].sort(
    (a, b) => STATUS_ORDER[a.displayStatus] - STATUS_ORDER[b.displayStatus] || a.categoryLabel.localeCompare(b.categoryLabel, "pt"),
  );
}
