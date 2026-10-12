import { apiGet, apiWrite } from "../../../../lib/api.ts";
import type { BalanceRow, HourCategory, TimeBankLedger } from "../../domain/entities/time-bank.ts";
import type { TimeBankApiPort } from "../../domain/ports/out/time-bank-api.port.ts";

const B = "/api/novo-rh/time-bank";

export class HttpTimeBankApiAdapter implements TimeBankApiPort {
  balances() {
    return apiGet<BalanceRow[]>(`${B}/balances`);
  }
  ledger(employeeId: string) {
    return apiGet<TimeBankLedger>(`${B}/employees/${employeeId}`);
  }
  async sync(employeeId: string, range?: { from: string; to: string }) {
    return (await apiWrite<{ posted: number; cutoff: string }>(`${B}/employees/${employeeId}/sync`, { body: range ?? {} })).data;
  }
  async compensate(employeeId: string, input: { mode: "rest" | "paid"; seconds: number; paymentMonth: string | null; reason: string }) {
    await apiWrite(`${B}/employees/${employeeId}/compensate`, { body: input });
  }
  async adjust(employeeId: string, input: { seconds: number; workDate: string | null; reason: string }) {
    await apiWrite(`${B}/employees/${employeeId}/adjust`, { body: input });
  }
  async decideValidation(employeeId: string, workDate: string, decision: "approve" | "reject", comment: string | null) {
    await apiWrite(`${B}/employees/${employeeId}/validations`, { body: { workDate, decision, comment } });
  }
  listCategories() {
    return apiGet<HourCategory[]>(`${B}/categories`);
  }
  async createCategory(input: Omit<HourCategory, "id" | "archived">) {
    return (await apiWrite<HourCategory>(`${B}/categories`, { body: input })).data;
  }
  async archiveCategory(id: string) {
    await apiWrite(`${B}/categories/${id}/archive`, {});
  }
}
