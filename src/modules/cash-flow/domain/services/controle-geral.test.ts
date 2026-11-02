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
    // Faturação = restaurante com IVA + plataformas com IVA (venda dos extratos).
    expect(cg.invoicingCents).toBe(sales.netCents + sales.vatCents + dre.revenue.platformsGrossCents);
    // Renda variável: 8% do que passa do limite.
    expect(cg.variableRent.cents).toBe(Math.round((cg.invoicingCents! - 100_000) * 0.08));
    expect(cg.balanceCents).toBe(cg.invoicingCents! - cg.totalLessDeductibleCents! - cg.variableRent.cents!);
    expect(cg.groups.reduce((a, g) => a + g.pctOfTotal!, 0)).toBeCloseTo(100, 0);
    // Os grupos com pagamentos no banco dizem as linhas da DRE (para abrir a lista).
    expect(by.DF!.sections).toEqual(["structure", "administrative", "financial"]);
  });

  it("plataformas com promoções: faturação = venda com IVA; o IVA das promoções vai com elas em DV; o saldo não muda", () => {
    const sales = sampleRestaurantSales();
    const dre = sampleDre();
    const before = composeControleGeral(dre, sales);
    // Venda 1 132,50 com IVA (1 000 sem IVA); promoções 113,25 com IVA (100 sem IVA): IVA pago pelos clientes = 1 019,25 − 900.
    const p = dre.revenue.byPlatform[0]!;
    const extra = { grossCents: 113_250, netCents: 100_000, salesVatCents: 11_925 };
    Object.assign(p, { grossCents: p.grossCents + extra.grossCents, netCents: p.netCents + extra.netCents, salesVatCents: p.salesVatCents + extra.salesVatCents });
    dre.revenue.platformsGrossCents += extra.grossCents;
    dre.revenue.platformsNetCents += extra.netCents;
    dre.vat.salesCents += extra.salesVatCents;
    dre.platformCosts.promotionsNetCents += 10_000;
    const after = composeControleGeral(dre, sales);
    expect(after.invoicingCents! - before.invoicingCents!).toBe(113_250);
    const dv = (cg: typeof before) => cg.groups.find((g) => g.key === "DV")!.amountCents!;
    // Promoções com IVA: 100 + 13,25.
    expect(dv(after) - dv(before)).toBe(11_325);
    // O saldo sobe o faturado sem IVA: 1 000 − 100 de promoções.
    expect(after.balanceCents! - before.balanceCents!).toBe(90_000);
  });

  it("embalagens (custo variável na DRE) contam nos insumos (DI), não em DV; o total não muda", () => {
    const sales = sampleRestaurantSales();
    const before = composeControleGeral(sampleDre(), sales);
    const dre = sampleDre();
    dre.expenses.categories.push({
      key: "g-opd", type: "group", groupId: "g-opd", code: "OPD", name: "Operação Direta", movementKind: null,
      netCents: 0, vatCents: 0, estimatedVatCents: 0, pendingVatCents: 0,
      children: [{ key: "c-emb", categoryId: "c-emb", code: null, name: "Embalagens e descartáveis", netCents: 10_000, vatCents: 2_300 }],
    });
    const after = composeControleGeral(dre, sales);
    const amount = (cg: typeof before, k: string) => cg.groups.find((g) => g.key === k)!.amountCents!;
    expect(amount(after, "DI") - amount(before, "DI")).toBe(12_300);
    expect(amount(before, "DV") - amount(after, "DV")).toBe(12_300);
    expect(after.totalCents).toBe(before.totalCents);
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
