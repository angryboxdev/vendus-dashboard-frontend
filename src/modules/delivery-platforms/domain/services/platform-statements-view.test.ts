import { describe, expect, it } from "vitest";
import { ImportPlatformDocumentsUseCase } from "../../application/use-cases/import-platform-documents.use-case.ts";
import type { DeliveryPlatformsApiPort } from "../ports/out/delivery-platforms-api.port.ts";
import { crossesMonth, periodLabel, saftCheck, totalsByPlatform, validatePlatformFiles } from "./platform-statements-view.ts";
import { sampleBoltAndSaft, sampleStatements } from "./fixtures.ts";

describe("platform-statements-view", () => {
  it("valida a seleção: vazia, demasiados ficheiros, formato", () => {
    expect(validatePlatformFiles([])).toMatch(/pelo menos um/);
    expect(validatePlatformFiles(Array.from({ length: 21 }, (_, i) => `e${i}.pdf`))).toMatch(/No máximo 20/);
    expect(validatePlatformFiles(["a.pdf", "b.xlsx"])).toBe("Só PDF, CSV ou XML: b.xlsx.");
    expect(validatePlatformFiles(["a.PDF", "b.csv", "saft.xml"])).toBeNull();
  });

  it("período e mês atravessado", () => {
    expect(periodLabel("2026-09-01", "2026-09-15")).toBe("01/09 – 15/09");
    expect(crossesMonth({ periodFrom: "2026-08-25", periodTo: "2026-09-07" }, 2026, 9)).toBe(true);
    expect(crossesMonth({ periodFrom: "2026-09-01", periodTo: "2026-09-30" }, 2026, 9)).toBe(false);
  });

  it("totais por plataforma, pela ordem Uber, Glovo", () => {
    const totals = totalsByPlatform(sampleStatements());
    expect(totals.map((t) => t.platform)).toEqual(["uber_eats", "glovo"]);
    expect(totals[1]).toMatchObject({ statements: 2, ordersCount: 50, salesCents: 150000, netPayoutCents: 90000 });
    expect(totals[0].platformCostsCents).toBe(10000 + 30000 + 5000 + 1000 + 0);
  });

  it("Bolt: o líquido soma o relatório de pedidos e as faturas; o SAF-T fica fora das plataformas", () => {
    const totals = totalsByPlatform([...sampleStatements(), ...sampleBoltAndSaft()]);
    expect(totals.map((t) => t.platform)).toEqual(["uber_eats", "glovo", "bolt_food"]);
    expect(totals[2]).toMatchObject({ statements: 2, ordersCount: 6, salesCents: 13000, platformCostsCents: 1500, netPayoutCents: 11500 });
  });

  it("conferência com o SAF-T: faturado × vendas − promoções; IVA médio", () => {
    expect(saftCheck(sampleStatements())).toBeNull();
    const check = saftCheck([...sampleStatements(), ...sampleBoltAndSaft()])!;
    expect(check.platformsCents).toBe(200000 - 10000 + 60000 + 90000 + 13000);
    expect(check.saftCents).toBe(343000);
    expect(check.differenceCents).toBe(343000 - 353000);
    expect(check.vatRate).toBeCloseTo(39700 / 303300, 6);
  });
});

describe("ImportPlatformDocumentsUseCase", () => {
  const api = (calls: string[][]): DeliveryPlatformsApiPort => ({
    importDocuments: async (files) => (calls.push(files.map((f) => f.name)), { imported: [], rejected: [] }),
    listStatements: async () => [],
  });

  it("envia uma seleção válida", async () => {
    const calls: string[][] = [];
    await new ImportPlatformDocumentsUseCase(api(calls)).execute([{ name: "uber.pdf", content: new ArrayBuffer(1) }]);
    expect(calls).toEqual([["uber.pdf"]]);
  });

  it("não envia uma seleção inválida", async () => {
    const calls: string[][] = [];
    await expect(new ImportPlatformDocumentsUseCase(api(calls)).execute([{ name: "x.docx", content: new ArrayBuffer(1) }])).rejects.toThrow(
      /Só PDF, CSV ou XML/,
    );
    expect(calls).toEqual([]);
  });
});
