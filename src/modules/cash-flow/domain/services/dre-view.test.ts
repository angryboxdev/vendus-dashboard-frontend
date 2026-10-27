import { describe, expect, it } from "vitest";
import { dreConfidencePct, platformLabel } from "./dre-view.ts";
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
