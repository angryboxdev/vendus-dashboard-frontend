import type { VatPeriodicity } from "./vat-overview.ts";

export interface AccountingSettings {
  vatPeriodicity: VatPeriodicity;
}

export interface UpdateAccountingSettingsPayload {
  vatPeriodicity: VatPeriodicity;
}
