import type { BalanceRow, HourCategory, TimeBankLedger } from "../../entities/time-bank.ts";

/** Banco de horas (`/api/novo-rh/time-bank`). */
export interface TimeBankApiPort {
  /** Saldos de todos os colaboradores do âmbito. */
  balances(): Promise<BalanceRow[]>;
  ledger(employeeId: string): Promise<TimeBankLedger>;
  sync(employeeId: string, range?: { from: string; to: string }): Promise<{ posted: number; cutoff: string }>;
  compensate(employeeId: string, input: { mode: "rest" | "paid"; seconds: number; paymentMonth: string | null; reason: string }): Promise<void>;
  adjust(employeeId: string, input: { seconds: number; workDate: string | null; reason: string }): Promise<void>;
  decideValidation(employeeId: string, workDate: string, decision: "approve" | "reject", comment: string | null): Promise<void>;
  listCategories(): Promise<HourCategory[]>;
  createCategory(input: Omit<HourCategory, "id" | "archived">): Promise<HourCategory>;
  archiveCategory(id: string): Promise<void>;
}
