import { describe, expect, it } from "vitest";
import type { PurchasePresentationDTO, StockItemDTO } from "../entities/stock-catalog.ts";
import { buildRows, filterRows, paginate, sortRows } from "./catalog-rows.ts";
import { deficit, presentationFor, replenishment, situation } from "./stock-rules.ts";
import { formatQuantity, formatUnitCost } from "./unit-cost.ts";

const item = (over: Partial<StockItemDTO>): StockItemDTO => ({
  id: "i", name: "Artigo", sku: null, category_id: "c", type: "ingredient", base_unit: "g", min_stock: 0, is_active: true, current_quantity: 0, has_movements: true, ...over,
});
const saco: PurchasePresentationDTO = { id: "p", supplierId: "s1", stockItemId: "mozz", packageUnit: "saco", contentQuantity: 2.5, contentUnit: "kg", invoicedBy: "content", minOrderPackages: 1, orderIncrementPackages: 1 };

describe("situação e défice (V6 §4/§11)", () => {
  it("473 g com mínimo 500 g → abaixo do mínimo, em falta 27 g", () => {
    const i = item({ current_quantity: 473, min_stock: 500 });
    expect(situation(i)).toBe("below");
    expect(deficit(i)).toBe(27);
  });

  it("0 g → «Sem stock»; sem mínimo não vira crítico; sem movimentos ≠ 0; inativo à parte", () => {
    expect(situation(item({ current_quantity: 0, min_stock: 500 }))).toBe("out");
    expect(situation(item({ current_quantity: 120, min_stock: 0 }))).toBe("ok");
    expect(deficit(item({ current_quantity: 120, min_stock: 0 }))).toBeNull();
    expect(situation(item({ current_quantity: 0, has_movements: false }))).toBe("no_data");
    expect(situation(item({ is_active: false, current_quantity: 0 }))).toBe("inactive");
    expect(situation(item({ current_quantity: 550, min_stock: 500 }))).toBe("near");
  });
});

describe("sugestão de compra com a embalagem confirmada (V6 §5)", () => {
  it("faltam 12 kg e o saco tem 2,5 kg → 5 sacos = 12,5 kg", () => {
    expect(replenishment(12000, "g", saco)).toEqual({ status: "ok", packages: 5, packageUnit: "saco", contentQuantity: 2.5, contentUnit: "kg", quantityBase: 12500, surplusBase: 500 });
  });

  it("sem embalagem confirmada ou noutra unidade → «Por confirmar» (nunca 1 un = 1 kg)", () => {
    expect(replenishment(12000, "g", null).status).toBe("to_confirm");
    expect(replenishment(12000, "un", saco).status).toBe("to_confirm");
    expect(replenishment(0, "g", saco).status).toBe("none");
  });

  it("embalagem do fornecedor habitual; sem esse, só se houver uma única", () => {
    const outro = { ...saco, id: "p2", supplierId: "s2", contentQuantity: 1 };
    expect(presentationFor("mozz", "s2", [saco, outro])?.id).toBe("p2");
    expect(presentationFor("mozz", null, [saco, outro])).toBeNull();
    expect(presentationFor("mozz", null, [saco])?.id).toBe("p");
  });
});

describe("custos e quantidades legíveis (V6 §3)", () => {
  it("unidade explícita e custos pequenos sem «0,00 €»", () => {
    expect(formatUnitCost(0.558, "g")).toMatch(/^5,58\s€\/kg$/);
    expect(formatUnitCost(0.42, "un")).toMatch(/^0,0042\s€\/un$/);
    expect(formatQuantity(8450, "g")).toBe("8,45 kg");
    expect(formatQuantity(473, "g")).toBe("473 g");
  });
});

describe("tabela única: vistas, filtros, ordenação, paginação", () => {
  const items = [
    item({ id: "a", name: "Mozzarella", current_quantity: 473, min_stock: 500 }),
    item({ id: "b", name: "Azeite", base_unit: "ml", current_quantity: 3000, min_stock: 1000 }),
    item({ id: "c", name: "Tomate", current_quantity: 0, min_stock: 20000 }),
    item({ id: "d", name: "Batedeira", type: "other", is_active: false }),
  ];
  const rows = buildRows(items, [{ id: "c", name: "Laticínios" }], [], []);

  it("Reposição mostra só o que tem algo em falta; o que precisa de atenção vem primeiro", () => {
    const repl = sortRows(filterRows(rows, { search: "", categoryId: "", type: "", status: "", situation: "" }, "replenishment"), "name", "asc", "replenishment");
    expect(repl.map((r) => [r.item.name, r.situation, r.missing])).toEqual([["Tomate", "out", 20000], ["Mozzarella", "below", 27]]);
  });

  it("pesquisa por nome/SKU, estado e paginação", () => {
    expect(filterRows(rows, { search: "azei", categoryId: "", type: "", status: "", situation: "" }, "general").map((r) => r.item.id)).toEqual(["b"]);
    expect(filterRows(rows, { search: "", categoryId: "", type: "", status: "inactive", situation: "" }, "general").map((r) => r.item.id)).toEqual(["d"]);
    expect(paginate([1, 2, 3, 4, 5], 2, 2)).toEqual({ rows: [3, 4], page: 2, pages: 3 });
    expect(paginate([1, 2], 9, 2).page).toBe(1);
  });

  it("custo manual separado do custo de compra (cêntimos por unidade base)", () => {
    const [r] = buildRows([item({ id: "x", purchase_reference_unit_cost_without_vat: 0.00779 })], [], [], []);
    expect(r!.cost).toBeNull();
    expect(r!.manualCents).toBeCloseTo(0.779, 6);
  });
});
