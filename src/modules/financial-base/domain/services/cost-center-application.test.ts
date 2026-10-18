import { describe, expect, it } from "vitest";
import { aggregateByCategory } from "./cost-center-application.ts";

const invoices = [
  { id: "i1", supplierName: "Makro", documentType: "invoice" as const },
  { id: "i2", supplierName: "Fornecedor misto", documentType: "invoice" as const },
  { id: "nc", supplierName: "Makro", documentType: "credit_note" as const },
];

describe("aggregateByCategory (Aplicação em Faturas)", () => {
  it("linhas «Por artigo» contam pelo líquido (com descontos), não pelo bruto", () => {
    // Mozzarella: 20 × 6,20 = 124,00 bruto; −10% → 111,60 líquido; IVA 6,70.
    const [row] = aggregateByCategory([{ invoiceId: "i1", costCenterCategoryId: "c1", totalWithVat: 11830, vatAmount: 670 }], [], invoices);
    expect(row!.totalWithoutVat).toBe(11160);
    expect(row!.byInvoice.get("i1")).toEqual({ cents: 11160, source: "lines" });
  });

  it("repartições «Por valores» somam-se às linhas na mesma subcategoria", () => {
    const rows = aggregateByCategory(
      [{ invoiceId: "i1", costCenterCategoryId: "c1", totalWithVat: 12300, vatAmount: 2300 }],
      [
        { invoiceId: "i2", costCenterCategoryId: "c1", netCents: 10000 },
        { invoiceId: "i2", costCenterCategoryId: "c2", netCents: 25000 },
        { invoiceId: "i2", costCenterCategoryId: "c3", netCents: 30000 },
      ],
      invoices,
    );
    const c1 = rows.find((r) => r.categoryId === "c1")!;
    expect(c1.totalWithoutVat).toBe(20000);
    expect([...c1.supplierNames]).toEqual(["Makro", "Fornecedor misto"]);
    expect(c1.byInvoice.get("i2")).toEqual({ cents: 10000, source: "allocations" });
    expect(rows.reduce((s, r) => s + (r.categoryId === "c1" ? 0 : r.totalWithoutVat), 0)).toBe(55000);
  });

  it("nota de crédito «Por valores» subtrai; linhas sem subcategoria ou de faturas desconhecidas ficam de fora", () => {
    const rows = aggregateByCategory(
      [
        { invoiceId: "i1", costCenterCategoryId: null, totalWithVat: 500, vatAmount: 0 },
        { invoiceId: "zz", costCenterCategoryId: "c1", totalWithVat: 500, vatAmount: 0 },
      ],
      [{ invoiceId: "nc", costCenterCategoryId: "c1", netCents: 2000 }],
      invoices,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.totalWithoutVat).toBe(-2000);
  });
});
