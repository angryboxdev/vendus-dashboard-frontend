import { describe, expect, it } from "vitest";
import { composeDreStatement } from "./dre-statement.ts";
import { sampleDre, sampleRestaurantSales } from "./dre-fixtures.ts";

const l = { platform: (k: string) => k, movementKind: (k: string | null) => `tipo:${k}`, euros: (c: number) => `${c / 100}€` };
const amount = (s: ReturnType<typeof composeDreStatement>, key: string) => s.lines.find((x) => x.key === key)?.amountCents;

describe("composeDreStatement", () => {
  it("cascata completa: receita bruta → líquida → lucro bruto → contribuição → operacional → lucro líquido", () => {
    const s = composeDreStatement(sampleDre(), sampleRestaurantSales(), l);
    expect(amount(s, "gross-revenue")).toBe(586_957);
    expect(amount(s, "card-fees")).toBe(3_955);
    expect(amount(s, "net-revenue")).toBe(556_957 - 3_955);
    expect(amount(s, "gross-profit")).toBe(483_002);
    expect(amount(s, "contribution")).toBe(483_002);
    expect(amount(s, "operating")).toBe(353_002);
    expect(s.operatingExpensesCents).toBe(483_002 - 353_002);
    expect(s.operatingExpensesPct).toBe(23.5);
    // Saldo acumulado: cada subtotal é o saldo nesse ponto.
    for (const ln of s.lines.filter((x) => x.kind === "subtotal" || x.kind === "result")) expect(ln.runningCents).toBe(ln.amountCents);
    expect(s.lines.find((x) => x.key === "restaurant")!.runningCents).toBe(500_000);
    expect(s.lines.find((x) => x.key === "platforms")!.runningCents).toBe(586_957);
    expect(s.lines.find((x) => x.key === "commissions")!.runningCents).toBe(556_957);
    expect(amount(s, "net-result")).toBe(353_002);
    expect(s.netMarginPct).toBe(63.8);
    expect(s.lines.find((x) => x.key === "cmv")!.pctOfNet).toBe(12.7);
    expect(s.lines.find((x) => x.key === "card-fees")!.hint).toBe("1% de 3955€ vendidos em cartão");
    expect(s.vatBalanceCents).toBe(65_000 + 13_043 - 29_900);
    // linhas de custo a zero não aparecem; «por classificar» leva o nome do tipo do extrato
    expect(s.lines.map((x) => x.key)).not.toContain("variable");
    expect(s.lines.find((x) => x.key === "unclassified")!.children[0]!.label).toBe("tipo:card_purchase");
  });

  it("plataforma pelos extratos: promoções e reembolsos deduzem à receita; origem no detalhe", () => {
    const dre = sampleDre();
    dre.revenue.byPlatform = [{ ...dre.revenue.byPlatform[0]!, source: "statements", promotionsNetCents: 5_000, otherFeesNetCents: 1_000 }];
    dre.platformCosts = { ...dre.platformCosts, promotionsNetCents: 5_000, otherFeesNetCents: 1_000, totalNetCents: 36_000 };
    const s = composeDreStatement(dre, sampleRestaurantSales(), l);
    expect(amount(s, "platform-deductions")).toBe(6_000);
    expect(amount(s, "net-revenue")).toBe(556_957 - 6_000 - 3_955);
    const platforms = s.lines.find((x) => x.key === "platforms")!;
    expect(platforms.hint).toBe("Pelos extratos importados (preço de tabela), sem IVA");
    expect(platforms.children[0]!.hint).toMatch(/^Pelos extratos · recebido/);
    expect(s.lines.find((x) => x.key === "platform-deductions")!.children.map((c) => c.label)).toEqual([
      "Promoções uber_eats",
      "Reembolsos e outras taxas uber_eats",
    ]);
  });

  it("só pelo banco: sem a linha de promoções e reembolsos", () => {
    const s = composeDreStatement(sampleDre(), sampleRestaurantSales(), l);
    expect(s.lines.map((x) => x.key)).not.toContain("platform-deductions");
    expect(s.lines.find((x) => x.key === "platforms")!.hint).toBe("Reconstituídas do recebido no banco, sem IVA");
  });

  it("só os custos: vendas do restaurante e totais a null; custos e plataformas com valor", () => {
    const s = composeDreStatement(sampleDre(), null, l);
    expect(amount(s, "restaurant")).toBeNull();
    expect(amount(s, "platforms")).toBe(86_957);
    expect(amount(s, "personnel")).toBe(120_000);
    expect(amount(s, "net-revenue")).toBeNull();
    expect(amount(s, "card-fees")).toBeNull();
    expect(s.netResultCents).toBeNull();
    expect(s.vatBalanceCents).toBeNull();
  });

  it("só as vendas: restaurante com valor; custos e totais a null", () => {
    const s = composeDreStatement(null, sampleRestaurantSales(), l);
    expect(amount(s, "restaurant")).toBe(500_000);
    expect(s.lines.find((x) => x.key === "restaurant")!.children.map((c) => c.label)).toEqual([
      "Venda restaurante cartão",
      "Venda restaurante dinheiro",
      "Outros (Eatz, MB Way…)",
    ]);
    expect(amount(s, "personnel")).toBeNull();
    expect(s.netResultCents).toBeNull();
  });

  it("CAPEX fora do resultado e marketing das plataformas na linha de marketing", () => {
    const costs = sampleDre();
    costs.expenses.sections.push({ key: "capex", netCents: 50_000, items: [] });
    costs.platformCosts.marketingNetCents = 10_000;
    costs.revenue.byPlatform[0]!.marketingNetCents = 10_000;
    const s = composeDreStatement(costs, sampleRestaurantSales(), l);
    expect(amount(s, "capex")).toBe(50_000);
    expect(amount(s, "marketing")).toBe(10_000);
    expect(amount(s, "net-result")).toBe(353_002 - 10_000);
  });

  it("fora da operação: CAPEX e retiradas/empréstimos abaixo do lucro, com o saldo depois deles; sem nada, o bloco não aparece", () => {
    const costs = sampleDre();
    costs.expenses.sections.push({ key: "capex", netCents: 50_000, items: [] });
    costs.expenses.offOperation = {
      totalCents: 30_000,
      items: [{ key: "c-ret", categoryId: "c-ret", code: "FDR.01", name: "Retirada de sócios", movementKind: null, netCents: 30_000 }],
    };
    const s = composeDreStatement(costs, sampleRestaurantSales(), l);
    expect(s.lines.slice(-4).map((x) => x.key)).toEqual(["off-heading", "capex", "off-operation", "after-off-operation"]);
    expect(amount(s, "off-operation")).toBe(30_000);
    expect(s.lines.find((x) => x.key === "off-operation")!.children[0]!.label).toBe("Retirada de sócios");
    expect(s.afterOffOperationCents).toBe(353_002 - 50_000 - 30_000);
    expect(amount(s, "after-off-operation")).toBe(353_002 - 50_000 - 30_000);
    // as rubricas do banco abrem os pagamentos
    expect(s.lines.find((x) => x.key === "personnel")!.entriesSection).toBe("personnel");
    expect(s.lines.find((x) => x.key === "off-operation")!.entriesSection).toBe("off_operation");
    expect(s.lines.find((x) => x.key === "net-revenue")!.entriesSection).toBeUndefined();

    const none = composeDreStatement(sampleDre(), sampleRestaurantSales(), l);
    expect(none.lines.map((x) => x.key)).not.toContain("off-heading");
    expect(none.afterOffOperationCents).toBe(none.netResultCents);
  });
});
