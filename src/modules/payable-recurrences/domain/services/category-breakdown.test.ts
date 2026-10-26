import { describe, expect, it } from "vitest";
import { buildCategoryBreakdown, NO_CATEGORY_LABEL } from "./category-breakdown.ts";

const item = (recurrenceId: string, categoryId: string | null, amountCents: number, supplierName = "Fornecedor A") => ({
  recurrenceId,
  categoryId,
  categoryName: categoryId ? `Cat ${categoryId}` : null,
  supplierName,
  amountCents,
});

describe("buildCategoryBreakdown", () => {
  it("agrupa por categoria, do maior para o menor, com % do total e barra relativa à maior", () => {
    const r = buildCategoryBreakdown([
      item("r1", "a", 30000),
      item("r2", "b", 60000, "Fornecedor B"),
      item("r3", "a", 10000),
    ]);
    expect(r.totalCents).toBe(100000);
    expect(r.rows.map((x) => [x.label, x.amountCents, x.percent, x.barPercent, x.recurrenceCount])).toEqual([
      ["Cat b", 60000, 60, 100, 1],
      ["Cat a", 40000, 40, (40000 / 60000) * 100, 2],
    ]);
    expect(r.recurrenceCount).toBe(3);
    expect(r.supplierCount).toBe(2);
  });

  it("junta as recorrências sem categoria numa linha própria", () => {
    const r = buildCategoryBreakdown([item("r1", null, 500), item("r2", null, 500)]);
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]!.label).toBe(NO_CATEGORY_LABEL);
    expect(r.rows[0]!.percent).toBe(100);
  });

  it("sem itens devolve vazio sem dividir por zero", () => {
    const r = buildCategoryBreakdown([]);
    expect(r).toEqual({ rows: [], totalCents: 0, recurrenceCount: 0, supplierCount: 0 });
  });
});
