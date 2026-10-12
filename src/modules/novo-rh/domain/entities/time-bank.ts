/** Novo RH → Banco de horas (Fase 6). Espelha `/api/novo-rh/time-bank`. */

export type EntryKind = "excess" | "deficit" | "multiplier" | "holiday" | "compensation_rest" | "compensation_paid" | "expiry" | "adjustment";

export interface LedgerRow {
  id: string;
  kind: EntryKind;
  seconds: number;
  workDate: string;
  postedOn: string;
  paymentMonth: string | null;
  reason: string;
  createdBy: string;
  running: number;
}

/** Saldo de um colaborador na lista da gestão (FE-034), até ao último apuramento. */
export interface BalanceRow {
  employeeId: string;
  name: string;
  locationName: string | null;
  balance: number;
  generated: number;
  compensatedRest: number;
  compensatedPaid: number;
  expired: number;
}

export interface TimeBankLedger {
  employeeId: string;
  cutoff: string;
  today: string;
  balance: number;
  available: number;
  compensateBeyondBalance: boolean;
  generated: number;
  compensatedRest: number;
  compensatedPaid: number;
  expired: number;
  pendingValidation: { workDate: string; excessSeconds: number }[];
  entries: LedgerRow[];
}

export interface HourWindow {
  weekdays: string[];
  start: string;
  end: string;
}

export interface HourCategory {
  id: string;
  name: string;
  validFrom: string;
  validTo: string | null;
  windows: HourWindow[];
  factor: number | null;
  archived: boolean;
}
