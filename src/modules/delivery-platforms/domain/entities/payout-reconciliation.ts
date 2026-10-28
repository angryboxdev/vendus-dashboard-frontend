import type { DeliveryPlatform } from "./platform-statement.ts";

/**
 * Conferência das transferências — contrato de `GET /api/delivery-platforms/payouts` (backend
 * `delivery-platforms`, F4). Cêntimos.
 */
type Platform = Exclude<DeliveryPlatform, "airmenu">;

export interface PlatformBankCredit {
  id: string;
  platform: Platform;
  date: string;
  amountCents: number;
}

/** ok = bate; difference = entrou com outro valor; pending = ainda não devia ter entrado; missing = devia e não entrou. */
export type PayoutStatus = "ok" | "difference" | "pending" | "missing";

export interface ExpectedPayout {
  platform: Platform;
  periodFrom: string;
  periodTo: string;
  paidOn: string | null;
  expectedCents: number;
  dueBy: string;
  received: { creditId: string; date: string; amountCents: number } | null;
  differenceCents: number | null;
  status: PayoutStatus;
}

export interface PlatformPayoutTotals {
  platform: Platform;
  expectedCents: number;
  receivedCents: number;
  differenceCents: number;
  pendingCents: number;
}

export interface PayoutReconciliation {
  period: { year: number; month: number; from: string; to: string };
  bankCoverageTo: string | null;
  payouts: ExpectedPayout[];
  totals: PlatformPayoutTotals[];
  unmatchedCredits: PlatformBankCredit[];
  warnings: string[];
}
