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
    expect(amount(s, "net-result")).toBe(353_002);
    expect(s.netMarginPct).toBe(63.8);
    expect(s.lines.find((x) => x.key === "cmv")!.pctOfNet).toBe(12.7);
    expect(s.lines.find((x) => x.key === "card-fees")!.hint).toBe("1% de 3955€ vendidos em cartão");
    expect(s.vatBalanceCents).toBe(65_000 + 13_043 - 29_900);
    // linhas de custo a zero não aparecem; «por classificar» leva o nome do tipo do extrato
    expect(s.lines.map((x) => x.key)).not.toContain("variable");
    expect(s.lines.find((x) => x.key === "unclassified")!.children[0]!.label).toBe("tipo:card_purchase");
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
});
