import type { DreExpenseSection, DreReport, DreRestaurantSales, DreSectionKey } from "../entities/dre.ts";

/**
 * DRE do Mapa em cascata, composta com o que já chegou: os custos (DRE rápida do banco, sem o
 * restaurante — `resultado?restaurante=0`) e as vendas do restaurante (Vendus, à parte). Cada linha é
 * `null` enquanto falta a parte de que depende; os totais só aparecem com as duas.
 */

export interface StatementChild {
  key: string;
  label: string;
  /** Rótulo secundário (ex.: «Recebido 631 € · margem 570 €»). */
  hint?: string;
  amountCents: number;
}

export interface StatementLine {
  key: string;
  label: string;
  /** revenue/cost = linha com valor; subtotal = «=»; result = lucro líquido; info = fora do resultado. */
  kind: "revenue" | "cost" | "subtotal" | "result" | "info";
  /** null = ainda a carregar. Custos em positivo (a vista mostra «−»). */
  amountCents: number | null;
  /** % da receita líquida (1 casa); null sem ela. */
  pctOfNet: number | null;
  children: StatementChild[];
  hint?: string;
}

export interface DreStatement {
  lines: StatementLine[];
  netRevenueCents: number | null;
  grossProfitCents: number | null;
  operatingResultCents: number | null;
  netResultCents: number | null;
  /** Lucro líquido ÷ receita líquida, %. */
  netMarginPct: number | null;
  /** IVA das vendas (restaurante + plataformas) − IVA dedutível; null sem as duas partes. */
  vatBalanceCents: number | null;
  vatSalesCents: number | null;
}

export type Labeler = {
  platform: (key: string) => string;
  movementKind: (kind: string | null) => string;
  euros: (cents: number) => string;
};

const SECTION_LABELS: Record<DreSectionKey, string> = {
  cmv: "CMV (mercadorias)",
  variable: "Custos variáveis",
  personnel: "Pessoal",
  structure: "Estrutura e instalações",
  administrative: "Administrativo",
  marketing: "Marketing",
  other: "Outros gastos",
  unclassified: "Outros gastos pelo extrato",
  financial: "Resultado financeiro",
  capex: "Investimentos (CAPEX) — fora do resultado",
};

const add = (...xs: (number | null)[]) => (xs.some((x) => x === null) ? null : xs.reduce<number>((a, x) => a + (x as number), 0));

export function composeDreStatement(costs: DreReport | null, sales: DreRestaurantSales | null, l: Labeler): DreStatement {
  const section = (k: DreSectionKey): DreExpenseSection | undefined => costs?.expenses.sections.find((s) => s.key === k);
  const sectionAmount = (k: DreSectionKey) => (costs ? (section(k)?.netCents ?? 0) : null);
  const sectionChildren = (k: DreSectionKey): StatementChild[] =>
    (section(k)?.items ?? []).map((i) => ({
      key: i.key,
      label: i.name ?? l.movementKind(i.movementKind),
      amountCents: i.netCents,
    }));

  const restaurant = sales ? sales.netCents : null;
  const platforms = costs ? costs.revenue.platformsNetCents : null;
  const grossRevenue = add(restaurant, platforms);
  const commissions = costs ? costs.platformCosts.commissionNetCents : null;
  // Comissão do TPA: o banco liquida o cartão já sem ela; vem com as vendas do restaurante.
  const cardFees = sales ? sales.cardFees.netCents : null;
  const netRevenue = grossRevenue === null || commissions === null || cardFees === null ? null : grossRevenue - commissions - cardFees;
  const pct = (v: number | null) => (v === null || netRevenue === null || netRevenue <= 0 ? null : Math.round((v / netRevenue) * 1000) / 10);

  const cmv = sectionAmount("cmv");
  const grossProfit = netRevenue === null || cmv === null ? null : netRevenue - cmv;
  const variable = sectionAmount("variable");
  const contribution = grossProfit === null || variable === null ? null : grossProfit - variable;
  const marketing = costs ? (section("marketing")?.netCents ?? 0) + costs.platformCosts.marketingNetCents : null;
  const opex: (number | null)[] = [sectionAmount("personnel"), sectionAmount("structure"), sectionAmount("administrative"), marketing, sectionAmount("other"), sectionAmount("unclassified")];
  const opexTotal = add(...opex);
  const operating = contribution === null || opexTotal === null ? null : contribution - opexTotal;
  const financial = sectionAmount("financial");
  const netResult = operating === null || financial === null ? null : operating - financial;

  const platformChildren: StatementChild[] = (costs?.revenue.byPlatform ?? []).map((p) => ({
    key: p.platform,
    label: `Venda plataforma ${l.platform(p.platform)}`,
    hint: `Recebido ${l.euros(p.receivedCents)} · margem ${l.euros(p.contributionCents)}`,
    amountCents: p.netCents,
  }));
  const restaurantChildren: StatementChild[] = sales
    ? [
        { key: "card", label: "Venda restaurante cartão", amountCents: sales.byPayment.cardNetCents },
        { key: "cash", label: "Venda restaurante dinheiro", amountCents: sales.byPayment.cashNetCents },
        { key: "other", label: "Outros (Eatz, MB Way…)", amountCents: sales.byPayment.otherNetCents },
      ].filter((c) => c.amountCents !== 0)
    : [];
  const marketingChildren: StatementChild[] = [
    ...sectionChildren("marketing"),
    ...(costs?.revenue.byPlatform ?? [])
      .filter((p) => p.marketingNetCents > 0)
      .map((p) => ({ key: `mkt-${p.platform}`, label: `Marketing ${l.platform(p.platform)}`, amountCents: p.marketingNetCents })),
  ];

  const line = (key: string, label: string, kind: StatementLine["kind"], amountCents: number | null, children: StatementChild[] = [], hint?: string): StatementLine => ({
    key,
    label,
    kind,
    amountCents,
    pctOfNet: kind === "info" ? null : pct(amountCents),
    children,
    ...(hint ? { hint } : {}),
  });
  const costLine = (k: DreSectionKey) => line(k, SECTION_LABELS[k], "cost", sectionAmount(k), sectionChildren(k));

  const lines: StatementLine[] = [
    line("restaurant", "Vendas do restaurante", "revenue", restaurant, restaurantChildren, "Vendus, sem IVA"),
    line("platforms", "Vendas das plataformas", "revenue", platforms, platformChildren, "Reconstituídas do recebido no banco, sem IVA"),
    line("gross-revenue", "Receita bruta", "subtotal", grossRevenue),
    line("commissions", "Comissões das plataformas", "cost", commissions),
    line("card-fees", "Comissões do TPA", "cost", cardFees, [], sales ? `${sales.cardFees.ratePct.toLocaleString("pt-PT")}% de ${l.euros(sales.cardFees.cardGrossCents)} vendidos em cartão` : undefined),
    line("net-revenue", "Receita líquida", "subtotal", netRevenue),
    costLine("cmv"),
    line("gross-profit", "Lucro bruto", "subtotal", grossProfit),
    costLine("variable"),
    line("contribution", "Margem de contribuição", "subtotal", contribution),
    costLine("personnel"),
    costLine("structure"),
    costLine("administrative"),
    line("marketing", SECTION_LABELS.marketing, "cost", marketing, marketingChildren),
    costLine("other"),
    costLine("unclassified"),
    line("operating", "Resultado operacional", "subtotal", operating),
    costLine("financial"),
    line("net-result", "Lucro líquido da operação", "result", netResult, [], "Antes de amortizações e IRC"),
    line("capex", SECTION_LABELS.capex, "info", sectionAmount("capex"), sectionChildren("capex")),
  ].filter((ln) => !(ln.kind === "cost" || ln.kind === "info") || ln.amountCents !== 0);

  const vatSales = sales && costs ? sales.vatCents + costs.vat.salesCents : null;
  return {
    lines,
    netRevenueCents: netRevenue,
    grossProfitCents: grossProfit,
    operatingResultCents: operating,
    netResultCents: netResult,
    netMarginPct: pct(netResult),
    vatSalesCents: vatSales,
    vatBalanceCents: vatSales === null || !costs ? null : vatSales - costs.vat.purchasesCents,
  };
}
