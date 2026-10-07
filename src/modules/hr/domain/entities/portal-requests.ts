/** Caixa de pedidos do Portal — contrato com `GET /api/hr/requests` (backend, módulo hr). */

export type PortalRequestKind = "justify_absence" | "day_off";
export type PortalRequestStatus = "pending" | "approved" | "rejected" | "cancelled";

export interface InboxRequest {
  id: string;
  kind: PortalRequestKind;
  status: PortalRequestStatus;
  workShiftId: string | null;
  startDate: string;
  endDate: string;
  reasonLabel: string;
  reasonText: string | null;
  attachmentName: string | null;
  decisionNote: string | null;
  decidedAt: string | null;
  createdAt: string;
  employeeId: string;
  employeeName: string;
  /** Justificar falta: horário do turno em causa. */
  shiftHours: string | null;
}

/** Documento enviado pelo colaborador no Portal, a aguardar validação. */
export interface PendingDocument {
  id: string;
  employeeId: string;
  employeeName: string;
  categoryLabel: string;
  fileName: string;
  expiresAt: string | null;
  submittedAt: string;
}

export interface RequestsInbox {
  requests: InboxRequest[];
  documents: PendingDocument[];
  total: number;
}

export const REQUEST_KIND_LABEL: Record<PortalRequestKind, string> = {
  justify_absence: "Justificar falta",
  day_off: "Pedido de folga",
};
