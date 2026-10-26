/**
 * DRE do mês pela conciliação bancária — contrato de `GET /api/reports/dre/resultado` (módulo backend
 * `cash-flow`). Tudo sem IVA, em cêntimos.
 */

export interface DrePlatformRevenue {
  /** uber_eats | glovo | bolt_food */
  platform: string;
  /** Liquidado no banco (com IVA, já sem comissão). */
  receivedCents: number;
  netCents: number;
}

export interface DreRevenue {
  restaurantNetCents: number;
  platformsNetCents: number;
  platformsReceivedCents: number;
  platformsSoldNetCents: number;
  /** Vendido sem IVA − recebido sem IVA (comissões e acertos, estimativa). */
  platformsCommissionEstimateCents: number;
  /** false: sem vendas do AirMenu para tirar o IVA — as liquidações contam pelo total. */
  platformsVatKnown: boolean;
  byPlatform: DrePlatformRevenue[];
  totalNetCents: number;
}

export interface DreExpenseChild {
  key: string;
  categoryId: string | null;
  code: string | null;
  name: string | null;
  netCents: number;
  vatCents: number;
}

export interface DreExpenseCategory {
  key: string;
  type: "group" | "unclassified";
  groupId: string | null;
  code: string | null;
  name: string | null;
  movementKind: string | null;
  netCents: number;
  vatCents: number;
  /** Parte contada pelo valor total por não se saber o IVA. */
  pendingVatCents: number;
  children: DreExpenseChild[];
}

export interface DreExpenses {
  totalNetCents: number;
  vatCents: number;
  pendingVatCents: number;
  unclassifiedCents: number;
  categories: DreExpenseCategory[];
}

export interface DreReport {
  period: { year: number; month: number; from: string; to: string; isCurrentMonth: boolean };
  revenue: DreRevenue;
  expenses: DreExpenses;
  manualAdjustments: { fixedCents: number; variableCents: number; totalCents: number };
  resultCents: number;
  marginPct: number | null;
  vat: { salesCents: number; purchasesCents: number; balanceCents: number };
}
