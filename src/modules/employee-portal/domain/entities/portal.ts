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
