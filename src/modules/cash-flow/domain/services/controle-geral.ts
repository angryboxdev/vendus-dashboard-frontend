import type { DreReport, DreRestaurantSales, DreSectionKey } from "../entities/dre.ts";

/**
 * «Controle geral» do mês (modelo da folha do utilizador): despesas por grupo, IVA e resumo, a partir
 * da DRE já calculada. Como na folha: faturação com IVA; despesas com o IVA pago; DIVA = todo o IVA das
 * vendas (IVA a reduzir + IVA a pagar); «despesas totais − IVA a reduzir» tira o IVA contado duas vezes;
 * saldo = faturação − (despesas − IVA a reduzir) − renda variável (≈ lucro da DRE − empréstimos − renda
 * variável). Agrupamento proposto (2026-10-28, a rever com o utilizador): ver `GROUP_SECTIONS`.
 */
export type ExpenseGroupKey = "DC" | "DF" | "DV" | "DP" | "DI" | "DIVA" | "DE";

export interface ExpenseGroupPart {
  label: string;
  amountCents: number;
}

export interface ExpenseGroup {
  key: ExpenseGroupKey;
  name: string;
  /** null enquanto falta parte dos dados (custos ou vendas). */
  amountCents: number | null;
  /** % do total das despesas. */
  pctOfTotal: number | null;
  /** Linhas da DRE com pagamentos no banco (para abrir a lista de pagamentos). */
  sections: DreSectionKey[];
  /** De onde vem o valor (só as partes com valor). */
  parts: ExpenseGroupPart[];
}

export interface ControleGeral {
  groups: ExpenseGroup[];
  totalCents: number | null;
  /** Despesas totais − IVA a reduzir (o IVA dedutível já está no DIVA). */
  totalLessDeductibleCents: number | null;
  /** % da faturação acima do limite (parâmetros do mês); 0 sem renda variável. */
  variableRent: { cents: number | null; thresholdCents: number; pct: number };
  /** Vendas do restaurante e das plataformas, com IVA. */
  invoicingCents: number | null;
  vat: { salesCents: number | null; deductibleCents: number | null; payableCents: number | null };
  /** Faturação − (despesas − IVA a reduzir) − renda variável. */
  balanceCents: number | null;
  /** Saldo ÷ faturação, %. */
  marginPct: number | null;
}

const NAMES: Record<ExpenseGroupKey, string> = {
  DC: "Despesa colaborador",
  DF: "Despesa fixa",
  DV: "Despesa variável",
  DP: "Despesa publicidade",
  DI: "Insumos (CMV e embalagens)",
  DIVA: "Despesa de IVA",
  DE: "Despesa empréstimo",
};

const SECTION_LABELS: Record<DreSectionKey, string> = {
  cmv: "CMV — mercadoria e ingredientes",
  variable: "Custos variáveis",
  personnel: "Pessoal (salários e encargos)",
  structure: "Estrutura",
  administrative: "Administrativo",
  marketing: "Marketing",
  other: "Outros gastos",
  unclassified: "Outros gastos pelo extrato",
  financial: "Resultado financeiro (juros, comissões bancárias)",
  capex: "Investimentos",
};

/** Linhas da DRE de cada grupo (o resto de cada grupo vem das plataformas, do TPA, do IVA ou dos parâmetros). */
const GROUP_SECTIONS: Record<ExpenseGroupKey, DreSectionKey[]> = {
  DC: ["personnel"],
  DF: ["structure", "administrative", "financial"],
  DV: ["variable", "other", "unclassified"],
  DP: ["marketing"],
  DI: ["cmv"],
  DIVA: [],
  DE: [],
};

const KEYS: ExpenseGroupKey[] = ["DC", "DF", "DV", "DP", "DI", "DIVA", "DE"];
const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : null);

export function composeControleGeral(costs: DreReport | null, sales: DreRestaurantSales | null): ControleGeral {
  const empty: ControleGeral = {
    groups: KEYS.map((key) => ({ key, name: NAMES[key], amountCents: null, pctOfTotal: null, sections: GROUP_SECTIONS[key], parts: [] })),
    totalCents: null,
    totalLessDeductibleCents: null,
    variableRent: { cents: null, thresholdCents: costs?.parameters.rentThresholdCents ?? 0, pct: costs?.parameters.rentVariablePct ?? 0 },
    invoicingCents: null,
    vat: { salesCents: null, deductibleCents: null, payableCents: null },
    balanceCents: null,
    marginPct: null,
  };
  if (!costs) return empty;

  const section = (k: DreSectionKey) => costs.expenses.sections.find((s) => s.key === k);
  const sectionParts = (key: ExpenseGroupKey): ExpenseGroupPart[] =>
    GROUP_SECTIONS[key].map((k) => ({ label: SECTION_LABELS[k], amountCents: (section(k)?.netCents ?? 0) + (section(k)?.vatCents ?? 0) }));
  const platforms = costs.revenue.byPlatform;
  const sum = (f: (p: (typeof platforms)[number]) => number) => platforms.reduce((a, p) => a + f(p), 0);

  const vatSales = sales ? sales.vatCents + costs.vat.salesCents : null;
  const vatPayable = vatSales === null ? null : vatSales - costs.vat.purchasesCents;

  const parts: Record<ExpenseGroupKey, ExpenseGroupPart[] | null> = {
    DC: sectionParts("DC"),
    DF: sectionParts("DF"),
    DV: sales
      ? [
          ...sectionParts("DV"),
          { label: "Comissões das plataformas", amountCents: sum((p) => p.commissionNetCents + p.commissionVatCents) },
          { label: "Promoções e reembolsos das plataformas", amountCents: costs.platformCosts.promotionsNetCents + costs.platformCosts.otherFeesNetCents },
          { label: "Comissões do TPA", amountCents: sales.cardFees.netCents },
        ]
      : null,
    DP: [...sectionParts("DP"), { label: "Marketing das plataformas", amountCents: sum((p) => p.marketingNetCents + p.marketingVatCents) }],
    DI: sectionParts("DI"),
    // Todo o IVA das vendas: o dedutível (a reduzir) e o que fica a pagar.
    DIVA:
      vatPayable === null
        ? null
        : [
            { label: "IVA a reduzir (dedutível)", amountCents: costs.vat.purchasesCents },
            { label: "IVA a pagar", amountCents: vatPayable },
          ],
    DE: [{ label: "Prestações de empréstimos (lançadas à mão nos parâmetros do mês)", amountCents: costs.parameters.loanExpenseCents ?? 0 }],
  };

  const amounts = KEYS.map((k) => (parts[k] === null ? null : parts[k]!.reduce((a, p) => a + p.amountCents, 0)));
  const ready = amounts.every((a) => a !== null);
  const totalCents = ready ? amounts.reduce<number>((a, v) => a + v!, 0) : null;
  const invoicingCents = sales && vatSales !== null ? sales.netCents + costs.revenue.platformsNetCents + vatSales : null;
  const totalLessDeductibleCents = totalCents === null ? null : totalCents - costs.vat.purchasesCents;
  const { rentThresholdCents = 0, rentVariablePct = 0 } = costs.parameters;
  const variableRentCents = invoicingCents === null ? null : Math.round((Math.max(0, invoicingCents - rentThresholdCents) * rentVariablePct) / 100);
  const balanceCents =
    totalLessDeductibleCents === null || invoicingCents === null || variableRentCents === null ? null : invoicingCents - totalLessDeductibleCents - variableRentCents;

  return {
    groups: KEYS.map((key, i) => ({
      key,
      name: NAMES[key],
      amountCents: amounts[i] ?? null,
      pctOfTotal: totalCents === null || amounts[i] === null ? null : pct(amounts[i]!, totalCents),
      sections: GROUP_SECTIONS[key],
      parts: (parts[key] ?? []).filter((p) => p.amountCents !== 0),
    })),
    totalCents,
    totalLessDeductibleCents,
    variableRent: { cents: variableRentCents, thresholdCents: rentThresholdCents, pct: rentVariablePct },
    invoicingCents,
    vat: { salesCents: vatSales, deductibleCents: costs.vat.purchasesCents, payableCents: vatPayable },
    balanceCents,
    marginPct: balanceCents === null || invoicingCents === null ? null : pct(balanceCents, invoicingCents),
  };
}
