import { describe, expect, it } from "vitest";
import { composeControleGeral } from "./controle-geral.ts";
import { sampleDre, sampleRestaurantSales } from "./dre-fixtures.ts";

describe("composeControleGeral", () => {
  it("agrupa as despesas com IVA (DC, DF, DV, DP, DI, DIVA, DE) e fecha faturação − despesas = saldo", () => {
    const dre = sampleDre();
    dre.parameters = { ...dre.parameters, loanExpenseCents: 25_000 };
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
    expect(by.DIVA!.amountCents).toBe(Math.max(0, vatSales - dre.vat.purchasesCents));
    expect(by.DE!.amountCents).toBe(25_000);
    expect(cg.totalCents).toBe(cg.groups.reduce((a, g) => a + g.amountCents!, 0));
    expect(cg.operationTotalCents).toBe(cg.totalCents! - 25_000);
    expect(cg.invoicingCents).toBe(sales.netCents + dre.revenue.platformsNetCents + vatSales);
    expect(cg.balanceCents).toBe(cg.invoicingCents! - cg.totalCents!);
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
