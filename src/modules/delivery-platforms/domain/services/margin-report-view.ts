import type { AllocationBasis, MarginReport, PlatformMargin } from "../entities/margin-report.ts";

export const MARGIN_COLUMN_LABELS: Record<PlatformMargin["platform"], string> = {
  uber_eats: "Uber Eats",
  glovo: "Glovo",
  bolt_food: "Bolt Food",
  total: "Total",
};

export const BASIS_LABELS: Record<AllocationBasis, string> = {
  month: "inteiro no mês",
  daily: "só os dias do mês",
  orders: "pelas vendas diárias da Bolt",
  saft: "pelo faturado diário do SAF-T",
  days: "pela proporção de dias (estimativa)",
};

export type MarginCell = { cents: number } | { pct: number | null } | { count: number };

export interface MarginRow {
  label: string;
  cell: (m: PlatformMargin) => MarginCell;
  /** Linha de resultado (= …), destacada. */
  strong?: boolean;
  tone?: "gross" | "net" | "estimate";
}

/** Linhas do quadro, da venda com IVA à margem líquida — as mesmas do PDF/Excel exportados. */
export function marginRows(r: MarginReport): MarginRow[] {
  return [
    { label: "Pedidos", cell: (m) => ({ count: m.ordersCount }) },
    { label: "Vendas, preço de tabela (com IVA)", cell: (m) => ({ cents: m.salesGrossCents }) },
    { label: "(−) IVA dentro do preço", cell: (m) => ({ cents: -(m.salesGrossCents - m.salesNetCents) }) },
    { label: "= Vendas sem IVA (base das %)", cell: (m) => ({ cents: m.salesNetCents }), strong: true },
    { label: "(−) Promoções", cell: (m) => ({ cents: -m.promotionsNetCents }) },
    { label: "(−) Comissões", cell: (m) => ({ cents: -m.commissionNetCents }) },
    { label: "(−) Marketing e campanhas", cell: (m) => ({ cents: -m.marketingNetCents }) },
    { label: "(−) Reembolsos e outras taxas", cell: (m) => ({ cents: -m.otherNetCents }) },
    { label: "= Margem bruta", cell: (m) => ({ cents: m.grossMarginCents }), strong: true, tone: "gross" },
    { label: "% das vendas", cell: (m) => ({ pct: m.grossMarginPct }), tone: "gross" },
    { label: `(−) Comida e embalagem (estim. ${r.foodCostPct}%)`, cell: (m) => ({ cents: -m.foodCostCents }), tone: "estimate" },
    { label: "= Margem líquida (estim.)", cell: (m) => ({ cents: m.netMarginCents }), strong: true, tone: "net" },
    { label: "% das vendas", cell: (m) => ({ pct: m.netMarginPct }), tone: "net" },
    { label: "IVA a entregar ao Estado", cell: (m) => ({ cents: m.vatToPayCents }) },
    { label: "Líquido dos extratos", cell: (m) => ({ cents: m.netPayoutCents }) },
  ];
}

/** «13,25%». */
export const rateLabel = (rate: number) => `${(rate * 100).toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
