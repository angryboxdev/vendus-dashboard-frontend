/** Resumo documental da ficha — espelho de `GET /api/novo-rh/people/:id/documents/summary` (backend, módulo `documents`). */
export interface EmployeeDocumentSummary {
  employeeId: string;
  /** Cargo — decide as categorias aplicáveis (`isCategoryApplicable`). */
  positionId: string | null;
  mandatoryTotal: number;
  mandatoryCompleted: number;
  /** Nomes amigáveis dos requisitos por cumprir (ex: "Documento de identificação"). */
  missingRequirements: string[];
  /** Categorias opcionais ainda sem documento. */
  missingOptional: string[];
  expiringSoonCount: number;
  /** Só alertas documentais (a expirar, em falta). */
  alerts: Array<{ type: "document_expiring" | "document_missing"; message: string }>;
}
