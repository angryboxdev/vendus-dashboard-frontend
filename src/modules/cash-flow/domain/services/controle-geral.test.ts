import { describe, expect, it } from "vitest";
import { composeControleGeral } from "./controle-geral.ts";
import { sampleDre, sampleRestaurantSales } from "./dre-fixtures.ts";

describe("composeControleGeral", () => {
  it("agrupa as despesas com IVA (DC, DF, DV, DP, DI, DIVA, DE) e fecha faturação − despesas = saldo", () => {
    const dre = sampleDre();
    dre.parameters = { ...dre.parameters, loanExpenseCents: 25_000, rentThresholdCents: 100_000, rentVariablePct: 8 };
    const sales = sampleRestaurantSales();
    const cg = composeControleGeral(dre, sales);
    const by = Object.fromEntries(cg.groups.map((g) => [g.key, g]));
    const sec = (k: string) => dre.expenses.sections.find((s) => s.key === k);
    const withVat = (k: string) => (sec(k)?.netCents ?? 0) + (sec(k)?.vatCents ?? 0);

    expect(by.DC!.amountCents).toBe(withVat("personnel"));
    expect(by.DI!.amountCents).toBe(withVat("cmv"));
    const uber = dre.revenue.byPlatform[0]!;
    // DV: custos variáveis/outros do banco + comissões das plataformas (com IVA) + comissão do TPA.
    expect(by.DV!.amountCents).toBe(withVat("variable") + withVat("other") + withVat("unclassified") + uber.commissionNetCents + uber.commissionVatCents + sales.cardFees.netCents);
    const vatSales = sales.vatCents + dre.vat.salesCents;
    // DIVA = todo o IVA das vendas (a reduzir + a pagar), como na folha.
    expect(by.DIVA!.amountCents).toBe(vatSales);
    expect(by.DE!.amountCents).toBe(25_000);
    expect(cg.totalCents).toBe(cg.groups.reduce((a, g) => a + g.amountCents!, 0));
    expect(cg.totalLessDeductibleCents).toBe(cg.totalCents! - dre.vat.purchasesCents);
    expect(cg.invoicingCents).toBe(sales.netCents + dre.revenue.platformsNetCents + vatSales);
    // Renda variável: 8% do que passa do limite.
    expect(cg.variableRent.cents).toBe(Math.round((cg.invoicingCents! - 100_000) * 0.08));
    expect(cg.balanceCents).toBe(cg.invoicingCents! - cg.totalLessDeductibleCents! - cg.variableRent.cents!);
    expect(cg.groups.reduce((a, g) => a + g.pctOfTotal!, 0)).toBeCloseTo(100, 0);
    // Os grupos com pagamentos no banco dizem as linhas da DRE (para abrir a lista).
    expect(by.DF!.sections).toEqual(["structure", "administrative", "financial"]);
  });

  it("sem as vendas: os grupos que dependem delas e o resumo ficam por carregar; sem custos, tudo", () => {
    const cg = composeControleGeral(sampleDre(), null);
    expect(cg.groups.find((g) => g.key === "DC")!.amountCents).not.toBeNull();
    expect(cg.groups.find((g) => g.key === "DV")!.amountCents).toBeNull();
    expect(cg.totalCents).toBeNull();
    expect(composeControleGeral(null, sampleRestaurantSales()).groups.every((g) => g.amountCents === null)).toBe(true);
  });
});

describe("composeControleGeral — exemplo da folha", () => {
  it("(25 375,85 − 19 000) × 8% = 510,07 de renda variável; sem % não há renda", () => {
    const dre = sampleDre();
    const sales = sampleRestaurantSales();
    // Faturação da folha: ajusta as vendas do restaurante para dar 25 375,85 com IVA.
    const vatSales = sales.vatCents + dre.vat.salesCents;
    sales.netCents = 2_537_585 - dre.revenue.platformsNetCents - vatSales;
    dre.parameters = { ...dre.parameters, rentThresholdCents: 1_900_000, rentVariablePct: 8 };
    expect(composeControleGeral(dre, sales).variableRent.cents).toBe(51_007);
    dre.parameters = { ...dre.parameters, rentVariablePct: 0 };
    expect(composeControleGeral(dre, sales).variableRent.cents).toBe(0);
  });
});
