/**
 * DRE do mês pela conciliação bancária — contrato de `GET /api/reports/dre/resultado` (módulo backend
 * `cash-flow`). Tudo sem IVA, em cêntimos.
 */

export type DeliveryPlatformKey = "uber_eats" | "glovo" | "bolt_food";

/** Parâmetros mensais da DRE — contrato de `GET|PUT /api/reports/dre/parametros`. Percentagens (15 = 15%). */
export interface DreParameters {
  deliverySalesVatPct: number;
  platformCommissionPct: number;
  platformCommissionVatPct: number;
  /** A comissão incide sobre a venda com IVA (true) ou sem IVA (false). */
  commissionOnGross: boolean;
  marketingVatPct: number;
  cardFeePct: number;
  /** IVA teórico dos gastos classificados sem fatura nem histórico. */
  expenseDefaultVatPct: number;
  /** Marketing das plataformas no mês, sem IVA. */
  marketingNetCents: Record<DeliveryPlatformKey, number>;
}

export interface ResolvedDreParameters extends DreParameters {
  /** month = do próprio mês; inherited = herdados do último mês com valores; default = de omissão. */
  source: "month" | "inherited" | "default";
}

/** Plataforma: o que liquidou no banco e a venda reconstituída em bruto. */
export interface DrePlatformRevenue {
  /** uber_eats | glovo | bolt_food */
  platform: string;
  /** Liquidado no banco (já sem comissão nem marketing). */
  receivedCents: number;
  marketingNetCents: number;
  /** Venda reconstituída, com IVA. */
  grossCents: number;
  /** Venda sem IVA (receita). */
  netCents: number;
  salesVatCents: number;
  commissionNetCents: number;
  commissionVatCents: number;
  marketingVatCents: number;
  /** Venda sem IVA − comissão − marketing. */
  contributionCents: number;
  contributionPct: number | null;
}

export interface DreRevenue {
  restaurantNetCents: number;
  restaurantByPayment: { cardNetCents: number; cashNetCents: number; otherNetCents: number };
  platformsGrossCents: number;
  platformsNetCents: number;
  platformsReceivedCents: number;
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
  /** Parte do IVA estimada (média das faturas da categoria ou IVA teórico). */
  estimatedVatCents: number;
  /** Parte contada pelo valor total por não se saber o IVA. */
  pendingVatCents: number;
  children: DreExpenseChild[];
}

export interface DreExpenses {
  totalNetCents: number;
  /** IVA dedutível (real + estimado). */
  vatCents: number;
  estimatedVatCents: number;
  pendingVatCents: number;
  unclassifiedCents: number;
  categories: DreExpenseCategory[];
  /** Os mesmos gastos pelas linhas da DRE (só as com valor, pela ordem da DRE). */
  sections: DreExpenseSection[];
  /** Investimentos (CAPEX): incluídos em `totalNetCents`, mas fora do resultado. */
  capexNetCents: number;
  /** Fora da operação (retiradas de sócios, capital de empréstimos, cauções): fora do resultado. */
  offOperation: { totalCents: number; items: DreSectionItem[] };
}

/** De onde vem o valor sem IVA de um pagamento. */
export type DreVatBasis = "exempt" | "real" | "estimated" | "pending";

/** Um pagamento (ou parte dele) por trás de uma rubrica da DRE — contrato de `GET /api/reports/dre/pagamentos`. */
export interface DreEntry {
  section: DreSectionKey | "off_operation";
  /** `DreSectionItem.key` da rubrica. */
  itemKey: string;
  movementId: string;
  /** Data do pagamento no banco. */
  paidOn: string;
  /** Data que decide o mês: a do documento conciliado, senão a do pagamento. */
  competenceDate: string;
  description: string | null;
  /** Fornecedor e número da fatura (ou nome do contrato recorrente). */
  document: string | null;
  /** De onde vem a categoria: o próprio movimento, o documento conciliado ou só o tipo do extrato. */
  basis: "movement" | "document" | "extract";
  grossCents: number;
  netCents: number;
  vatBasis: DreVatBasis;
}

export interface DreEntries {
  period: DreReport["period"];
  entries: DreEntry[];
}

/** Comissão do TPA: taxa do mês sobre o vendido em cartão (o banco liquida já sem ela). */
export interface DreCardFees {
  cardGrossCents: number;
  ratePct: number;
  netCents: number;
}

export interface DreReport {
  period: { year: number; month: number; from: string; to: string; isCurrentMonth: boolean };
  /** false = pedido rápido sem as vendas do restaurante (Vendus): resultado e margem a null. */
  restaurantSalesLoaded: boolean;
  parameters: ResolvedDreParameters;
  revenue: DreRevenue;
  /** Comissões e marketing das plataformas, sem IVA. */
  platformCosts: { commissionNetCents: number; marketingNetCents: number; totalNetCents: number };
  /** Zero no pedido rápido (sem as vendas do restaurante). */
  cardFees: DreCardFees;
  expenses: DreExpenses;
  resultCents: number | null;
  marginPct: number | null;
  vat: { salesCents: number; purchasesCents: number; purchasesEstimatedCents: number; balanceCents: number };
}

/** Linha da DRE de um gasto (tipo financeiro da categoria; sem fatura, o tipo genérico do extrato). */
export type DreSectionKey =
  | "cmv"
  | "variable"
  | "personnel"
  | "structure"
  | "administrative"
  | "marketing"
  | "financial"
  | "capex"
  | "other"
  | "unclassified";

export interface DreSectionItem {
  key: string;
  categoryId: string | null;
  code: string | null;
  name: string | null;
  /** Tipo genérico do banco, quando a saída não tem categoria. */
  movementKind: string | null;
  netCents: number;
}

export interface DreExpenseSection {
  key: DreSectionKey;
  netCents: number;
  items: DreSectionItem[];
}

/** Só as vendas do restaurante do mês — contrato de `GET /api/reports/dre/vendas-restaurante`. */
export interface DreRestaurantSales {
  period: DreReport["period"];
  netCents: number;
  vatCents: number;
  byPayment: DreRevenue["restaurantByPayment"];
  cardFees: DreCardFees;
}
