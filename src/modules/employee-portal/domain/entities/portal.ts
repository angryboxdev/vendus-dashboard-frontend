/** Portal do Colaborador — contrato com `GET /api/me` e `POST /api/me/punches` (backend, módulo hr). */

export type PunchKind = "in" | "out";
export type GeofencePolicy = "off" | "warn" | "block";
export type GeofenceStatus = "inside" | "outside" | "unverified" | "not_required";
export type UnverifiedReason = "low_accuracy" | "ambiguous" | "permission_denied" | "unavailable" | "timeout" | "location_not_configured";

export type PunchRefusal =
  | { code: "NO_SHIFT" }
  | { code: "TOO_EARLY"; shiftStart: string; opensAt: string }
  | { code: "SHIFT_ENDED" }
  | { code: "DAY_COMPLETE" }
  | { code: "ALREADY_IN"; since: string }
  | { code: "NOT_IN" }
  | { code: "TOO_SOON" };

export interface PortalShift {
  workDate: string;
  startTime: string;
  endTime: string;
  endsNextDay: boolean;
  secondStartTime: string | null;
  secondEndTime: string | null;
  locationId: string;
  locationName: string;
}

export interface PortalHome {
  employee: { id: string; shortName: string };
  nextShift: PortalShift | null;
  punch: {
    state: "not_in" | "in" | "done" | "no_shift";
    since: string | null;
    action: PunchKind | null;
    blockedReason: PunchRefusal | null;
    geofencePolicy: GeofencePolicy;
  };
}

/** Leitura crua do telemóvel no momento do toque (o servidor decide dentro/fora). */
export type ClientLocation =
  | { latitude: number; longitude: number; accuracyM: number }
  | { error: "permission_denied" | "unavailable" | "timeout" };

export interface PunchResult {
  kind: PunchKind;
  time: string;
  serverAt: string;
  geofence: { status: GeofenceStatus; reason: UnverifiedReason | null; distanceM: number | null };
  flagged: boolean;
  replay: boolean;
}

/** Recusa de negócio vinda do servidor (409) — a mensagem já vem em PT-PT. */
export class PunchRefusedError extends Error {
  readonly code: string;
  readonly details: Record<string, unknown>;

  constructor(code: string, message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = "PunchRefusedError";
    this.code = code;
    this.details = details;
  }
}

/** A conta autenticada não está ligada a nenhuma ficha de colaborador. */
export class PortalNotLinkedError extends Error {
  constructor() {
    super("Esta conta não está ligada a nenhum colaborador.");
    this.name = "PortalNotLinkedError";
  }
}

/** Sem ligação ao servidor — a picagem nunca é feita offline (decisão do MVP). */
export class PortalOfflineError extends Error {
  constructor() {
    super("Sem ligação. A picagem precisa de internet — verifique a ligação e tente novamente.");
    this.name = "PortalOfflineError";
  }
}

// ── Self-service (tickets 07–09): `/api/me/shifts`, `/documents`, `/leave` ──

export interface MyShift extends PortalShift {
  id: string;
}

/** Quem trabalha comigo — só nome curto, cargo e horário (o servidor não manda mais nada). */
export interface Coworker {
  shortName: string;
  positionName: string | null;
  hours: string;
}

export interface MyDocument {
  id: string;
  categoryLabel: string;
  fileName: string;
  /** "valid" ou "pending_validation" (enviado no Portal, aguarda o RH). */
  status: string;
  /** Vencido / a vencer em 30 dias e sem envio pendente. */
  canReplace: boolean;
  /** Último envio rejeitado pelo RH (motivo). */
  lastRejection: { note: string; at: string } | null;
  /** `YYYY-MM` nos recibos. */
  period: string | null;
  isPayslip: boolean;
  issuedAt: string | null;
  expiresAt: string | null;
  uploadedAt: string;
}

export type LeaveType = "vacation" | "sick_leave" | "justified" | "unjustified" | "compensatory" | "authorized_absence" | "license" | "other";

export interface MyLeaveEntry {
  id: string;
  type: LeaveType;
  startDate: string;
  endDate: string;
  workingDays: number;
}

export interface MyLeave {
  year: number;
  entries: MyLeaveEntry[];
}

/** Turno/documento que não existe ou não é do próprio (404). */
export class PortalNotFoundError extends Error {
  constructor() {
    super("Não encontrado.");
    this.name = "PortalNotFoundError";
  }
}

// ── Pedidos (ticket 12) ──────────────────────────────────────────────────

export type RequestKind = "justify_absence" | "day_off";
export type RequestStatus = "pending" | "approved" | "rejected" | "cancelled";

export interface MyRequest {
  id: string;
  kind: RequestKind;
  status: RequestStatus;
  workShiftId: string | null;
  startDate: string;
  endDate: string;
  reasonLabel: string;
  reasonText: string | null;
  attachmentName: string | null;
  decisionNote: string | null;
  decidedAt: string | null;
  createdAt: string;
}

export type NewRequest =
  | { kind: "justify_absence"; workShiftId: string; reasonCode: string; reasonText: string | null; attachment: File | null }
  | { kind: "day_off"; startDate: string; endDate: string; reasonCode: string; reasonText: string | null };

/** Mesmos motivos do backend (`REQUEST_REASONS`). */
export const REQUEST_REASONS: Record<RequestKind, Array<{ code: string; label: string }>> = {
  justify_absence: [
    { code: "medical", label: "Consulta ou atestado médico" },
    { code: "sick", label: "Doença" },
    { code: "family", label: "Assunto familiar" },
    { code: "transport", label: "Problema de transporte" },
    { code: "other", label: "Outro motivo" },
  ],
  day_off: [
    { code: "personal", label: "Assunto pessoal" },
    { code: "family", label: "Assunto familiar" },
    { code: "medical", label: "Consulta médica" },
    { code: "study", label: "Estudos / exame" },
    { code: "other", label: "Outro motivo" },
  ],
};

/** Recusa vinda do servidor (400/409) — a mensagem já vem em PT-PT. */
export class PortalRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PortalRequestError";
  }
}
