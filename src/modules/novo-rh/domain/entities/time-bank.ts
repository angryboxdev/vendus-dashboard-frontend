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
