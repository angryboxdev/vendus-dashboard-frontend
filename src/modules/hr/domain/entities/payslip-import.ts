/**
 * Importação em massa de recibos de vencimento (Base Organizacional,
 * ticket 10) — espelho de `payslip-import.ports.ts` do backend
 * (`POST /api/hr/payslips/import/preview` e `/import`).
 */

/**
 * Categorias que a importação aceita (semeadas pelo backend): recibo de
 * vencimento (contratados) e recibo verde (prestadores independentes).
 */
export type PayslipCategory = "recibo_vencimento" | "recibo_verde";

export const PAYSLIP_CATEGORY_LABELS: Record<PayslipCategory, string> = {
  recibo_vencimento: "Recibo de vencimento",
  recibo_verde: "Recibo verde",
};

export type PayslipPreviewStatus = "identified" | "duplicate" | "review";
export type PayslipMatchReason = "nif" | "employee_id" | "name" | "file_name";
export type PayslipReviewReason = "no_match" | "ambiguous" | "conflict" | "repeated_in_batch";

export interface PayslipPreviewRow {
  fileName: string;
  period: string;
  status: PayslipPreviewStatus;
  employeeId: string | null;
  employeeName: string | null;
  matchReason: PayslipMatchReason | null;
  reviewReason: PayslipReviewReason | null;
  candidates: { id: string; name: string }[];
  existingDocumentId: string | null;
  hasText: boolean;
}

export interface PayslipMappingEntry {
  fileName: string;
  employeeId: string;
  action: "create" | "replace";
}

export type PayslipImportOutcome = "created" | "replaced" | "duplicate" | "failed";

export interface PayslipImportResult {
  fileName: string;
  employeeId: string;
  outcome: PayslipImportOutcome;
  documentId: string | null;
  message: string | null;
}

export const PAYSLIP_STATUS_LABELS: Record<PayslipPreviewStatus, { label: string; cls: string }> = {
  identified: { label: "Identificado", cls: "bg-emerald-50 text-emerald-700" },
  duplicate: { label: "Já existe", cls: "bg-amber-50 text-amber-700" },
  review: { label: "Rever", cls: "bg-red-50 text-red-600" },
};

export const PAYSLIP_MATCH_REASON_LABELS: Record<PayslipMatchReason, string> = {
  nif: "pelo NIF",
  employee_id: "pelo código do colaborador",
  name: "pelo nome no recibo",
  file_name: "pelo nome do ficheiro",
};

export const PAYSLIP_REVIEW_REASON_LABELS: Record<PayslipReviewReason, string> = {
  no_match: "Colaborador não identificado",
  ambiguous: "Mais de um colaborador possível",
  conflict: "NIF e nome não coincidem",
  repeated_in_batch: "Mais de um ficheiro para o mesmo colaborador",
};

export const PAYSLIP_OUTCOME_LABELS: Record<PayslipImportOutcome, string> = {
  created: "Importado",
  replaced: "Versão substituída",
  duplicate: "Já existia — não importado",
  failed: "Erro",
};

/** Mensagem da task §26 para um recibo já existente no período. */
export const PAYSLIP_DUPLICATE_MESSAGE = "Já existe um recibo deste colaborador para este período.";
