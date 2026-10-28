import { describe, expect, it } from "vitest";
import { deliveryParametersUse, dreConfidencePct, platformLabel } from "./dre-view.ts";
import { sampleDre } from "./dre-fixtures.ts";

describe("dreConfidencePct", () => {
  it("parte dos gastos com categoria e IVA conhecido, sem contar duas vezes o que está por classificar", () => {
    expect(dreConfidencePct(sampleDre())).toBe(90);
    const r = sampleDre();
    r.expenses = { ...r.expenses, totalNetCents: 0 };
    expect(dreConfidencePct(r)).toBeNull();
  });

  it("nomes das plataformas", () => {
    expect(platformLabel("uber_eats")).toBe("Uber Eats");
    expect(platformLabel("outra")).toBe("outra");
  });
});

describe("deliveryParametersUse", () => {
  it("sem extratos: os parâmetros valem para todas; com extratos: diz quais vêm deles e a quais as taxas ainda se aplicam", () => {
    expect(deliveryParametersUse(sampleDre())).toEqual({ fromStatements: [], ratesNote: null });
    expect(deliveryParametersUse(null)).toEqual({ fromStatements: [], ratesNote: null });
    const dre = sampleDre();
    const uber = dre.revenue.byPlatform[0]!;
    dre.revenue.byPlatform = [{ ...uber, source: "statements", marketingNetCents: 41_659 }, { ...uber, platform: "bolt_food", source: "bank" }];
    expect(deliveryParametersUse(dre)).toEqual({
      fromStatements: [{ platform: "uber_eats", marketingNetCents: 41_659 }],
      ratesNote: "Usadas só em Bolt Food (sem extratos). Uber Eats: pelos extratos importados.",
    });
    dre.revenue.byPlatform = [{ ...uber, source: "statements" }];
    expect(deliveryParametersUse(dre).ratesNote).toMatch(/Todas as plataformas deste mês têm extratos importados \(Uber Eats\)/);
  });
});
