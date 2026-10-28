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
  /** revenue/cost = linha com valor; subtotal = «=»; result = lucro líquido; info = fora do resultado; heading = título de bloco. */
  kind: "revenue" | "cost" | "subtotal" | "result" | "info" | "heading";
  /** null = ainda a carregar. Custos em positivo (a vista mostra «−»). */
  amountCents: number | null;
  /** % da receita líquida (1 casa); null sem ela. */
  pctOfNet: number | null;
  /**
   * Saldo acumulado até esta linha (receitas somam, custos e o que fica fora da operação subtraem); nos
   * subtotais é o próprio subtotal. null nos títulos ou enquanto falta algum valor anterior.
   */
  runningCents?: number | null;
  children: StatementChild[];
  hint?: string;
  /** Linha com pagamentos para conferir (`DreEntry.section`); só nas rubricas de gastos do banco. */
  entriesSection?: DreSectionKey | "off_operation";
}

export interface DreStatement {
  lines: StatementLine[];
  netRevenueCents: number | null;
  grossProfitCents: number | null;
  /** Do lucro bruto ao resultado operacional: custos variáveis + despesas operacionais (pessoal, estrutura, administrativos, marketing, outros). */
  operatingExpensesCents: number | null;
  /** Despesas operacionais ÷ receita líquida, %. */
  operatingExpensesPct: number | null;
  operatingResultCents: number | null;
  netResultCents: number | null;
  /** Lucro líquido − investimentos (CAPEX) − fora da operação: o que sobra do mês. */
  afterOffOperationCents: number | null;
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
  capex: "Investimentos (CAPEX)",
};

/** Rubricas de gastos do banco: cada uma abre os pagamentos que a compõem. */
const ENTRY_SECTIONS = new Set<DreSectionKey>(["cmv", "variable", "personnel", "structure", "administrative", "marketing", "other", "unclassified", "financial", "capex"]);

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
  // Promoções, reembolsos e outras taxas das plataformas: só existem quando há extratos importados.
  const platformDeductions = costs ? costs.platformCosts.promotionsNetCents + costs.platformCosts.otherFeesNetCents : null;
  // Comissão do TPA: o banco liquida o cartão já sem ela; vem com as vendas do restaurante.
  const cardFees = sales ? sales.cardFees.netCents : null;
  const netRevenue =
    grossRevenue === null || commissions === null || platformDeductions === null || cardFees === null
      ? null
      : grossRevenue - commissions - platformDeductions - cardFees;
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

  const byPlatform = costs?.revenue.byPlatform ?? [];
  const platformChildren: StatementChild[] = byPlatform.map((p) => ({
    key: p.platform,
    label: `Venda plataforma ${l.platform(p.platform)}`,
    hint: `${p.source === "statements" ? "Pelos extratos" : "Pelo banco"} · recebido ${l.euros(p.receivedCents)} · margem ${l.euros(p.contributionCents)}`,
    amountCents: p.netCents,
  }));
  const fromStatements = byPlatform.filter((p) => p.source === "statements");
  const platformsHint =
    fromStatements.length === 0
      ? "Reconstituídas do recebido no banco, sem IVA"
      : fromStatements.length === byPlatform.length
        ? "Pelos extratos importados (preço de tabela), sem IVA"
        : `Pelos extratos: ${fromStatements.map((p) => l.platform(p.platform)).join(", ")}; as outras pelo banco · sem IVA`;
  const deductionChildren: StatementChild[] = fromStatements.flatMap((p) => [
    { key: `promo-${p.platform}`, label: `Promoções ${l.platform(p.platform)}`, amountCents: p.promotionsNetCents },
    { key: `other-${p.platform}`, label: `Reembolsos e outras taxas ${l.platform(p.platform)}`, amountCents: p.otherFeesNetCents },
  ]).filter((c) => c.amountCents !== 0);
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
    pctOfNet: kind === "info" || kind === "heading" ? null : pct(amountCents),
    children,
    ...(hint ? { hint } : {}),
    ...(ENTRY_SECTIONS.has(key as DreSectionKey) ? { entriesSection: key as DreSectionKey } : {}),
  });
  const costLine = (k: DreSectionKey) => line(k, SECTION_LABELS[k], "cost", sectionAmount(k), sectionChildren(k));

  // Fora da operação: investimentos e o grupo «Fora da DRE» (retiradas de sócios, capital de empréstimos…).
  const capex = sectionAmount("capex");
  const off = costs ? costs.expenses.offOperation : null;
  const offChildren: StatementChild[] = (off?.items ?? []).map((i) => ({ key: i.key, label: i.name ?? l.movementKind(i.movementKind), amountCents: i.netCents }));
  const afterOff = netResult === null || capex === null || off === null ? null : netResult - capex - off.totalCents;
  const offLine: StatementLine = { ...line("off-operation", "Retiradas, empréstimos e outros", "info", off ? off.totalCents : null, offChildren, "Pelo valor pago"), entriesSection: "off_operation" };

  const lines: StatementLine[] = [
    line("restaurant", "Vendas do restaurante", "revenue", restaurant, restaurantChildren, "Vendus, sem IVA"),
    line("platforms", "Vendas das plataformas", "revenue", platforms, platformChildren, platformsHint),
    line("gross-revenue", "Receita bruta", "subtotal", grossRevenue),
    line("commissions", "Comissões das plataformas", "cost", commissions),
    line("platform-deductions", "Promoções e reembolsos das plataformas", "cost", platformDeductions, deductionChildren, "Pelos extratos importados"),
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
    line("off-heading", "Fora da operação — não conta no lucro", "heading", null),
    line("capex", SECTION_LABELS.capex, "info", capex, sectionChildren("capex")),
    offLine,
    line("after-off-operation", "Saldo depois de investimentos e retiradas", "subtotal", afterOff),
  ].filter((ln) => !(ln.kind === "cost" || ln.kind === "info") || ln.amountCents !== 0);
  // Sem nada fora da operação, o bloco não aparece.
  const hasOff = lines.some((ln) => ln.key === "capex" || ln.key === "off-operation");
  const shown = withRunningBalance(hasOff ? lines : lines.filter((ln) => ln.key !== "off-heading" && ln.key !== "after-off-operation"));

  const vatSales = sales && costs ? sales.vatCents + costs.vat.salesCents : null;
  return {
    lines: shown,
    netRevenueCents: netRevenue,
    grossProfitCents: grossProfit,
    operatingExpensesCents: grossProfit === null || operating === null ? null : grossProfit - operating,
    operatingExpensesPct: grossProfit === null || operating === null ? null : pct(grossProfit - operating),
    operatingResultCents: operating,
    netResultCents: netResult,
    afterOffOperationCents: hasOff ? afterOff : netResult,
    netMarginPct: pct(netResult),
    vatSalesCents: vatSales,
    vatBalanceCents: vatSales === null || !costs ? null : vatSales - costs.vat.purchasesCents,
  };
}

/**
 * Saldo acumulado linha a linha, de cima para baixo: receita soma, custo e «fora da operação» subtraem,
 * subtotais e resultado mostram o saldo nesse ponto (igual ao próprio subtotal). Falta um valor → null daí
 * para baixo.
 */
export function withRunningBalance(lines: StatementLine[]): StatementLine[] {
  let running: number | null = 0;
  return lines.map((ln) => {
    if (ln.kind === "heading") return { ...ln, runningCents: null };
    if (running !== null) {
      if (ln.amountCents === null) running = null;
      else if (ln.kind === "revenue") running += ln.amountCents;
      else if (ln.kind === "cost" || ln.kind === "info") running -= ln.amountCents;
    }
    return { ...ln, runningCents: running };
  });
}
