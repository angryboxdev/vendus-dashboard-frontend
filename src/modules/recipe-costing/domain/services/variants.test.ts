import { describe, expect, it } from "vitest";
import type { RecipeItemDTO } from "../entities/technical-sheets.ts";
import { allowsXs, compositionRows, dishVariants, planRowChanges, xsQuantity } from "./variants.ts";
import { buildDishRows, missingSummary } from "./sheet-rows.ts";

// Dados fictícios.
const item = (over: Partial<RecipeItemDTO>): RecipeItemDTO => ({ id: "i", recipe_id: "r", stock_item_id: null, preparation_id: null, size: "small", quantity: 1, waste_factor: null, ...over });

describe("variantes das fichas técnicas (V7)", () => {
  it("XS só nas doces e exatamente metade da Pequena", () => {
    expect(allowsXs("sweeties")).toBe(true);
    expect(allowsXs("classics")).toBe(false);
    expect(xsQuantity(70)).toBe(35);
    expect(xsQuantity(0.5)).toBe(0.25);
    expect(xsQuantity(0.333)).toBe(0.167);
  });

  it("variantes pela ordem XS → Pequena → Grande; um prato só com Grande tem uma variante", () => {
    expect(dishVariants([item({ size: "large" }), item({ size: "small" })], ["xs"])).toEqual(["xs", "small", "large"]);
    expect(dishVariants([item({ size: "large" })], ["large"])).toEqual(["large"]);
  });

  it("uma linha por componente com as quantidades de cada variante; preparações primeiro", () => {
    const rows = compositionRows([
      item({ id: "a", stock_item_id: "granulado", size: "small", quantity: 20 }),
      item({ id: "b", preparation_id: "brig", size: "small", quantity: 70 }),
      item({ id: "c", preparation_id: "brig", size: "large", quantity: 140 }),
    ]);
    expect(rows.map((r) => [r.key, Object.keys(r.bySize)])).toEqual([
      ["preparation:brig", ["small", "large"]],
      ["stock:granulado", ["small"]],
    ]);
  });

  it("gravar: XS segue a Pequena nas doces; 0 apaga; sem alteração não grava", () => {
    const [row] = compositionRows([item({ id: "s", preparation_id: "brig", size: "small", quantity: 70 }), item({ id: "x", preparation_id: "brig", size: "xs", quantity: 35 })]);
    expect(planRowChanges(row!, { small: 80, large: 160 }, { xsFollowsSmall: true })).toEqual([
      { op: "update", itemId: "x", size: "xs", quantity: 40 },
      { op: "update", itemId: "s", size: "small", quantity: 80 },
      { op: "add", size: "large", quantity: 160 },
    ]);
    expect(planRowChanges(row!, { small: 0 }, { xsFollowsSmall: true })).toEqual([
      { op: "delete", itemId: "x", size: "xs" },
      { op: "delete", itemId: "s", size: "small" },
    ]);
    expect(planRowChanges(row!, { small: 70 }, { xsFollowsSmall: true })).toEqual([]);
    // Sem a regra (pratos salgados), a XS não é tocada.
    expect(planRowChanges(row!, { small: 90 }, { xsFollowsSmall: false })).toEqual([{ op: "update", itemId: "s", size: "small", quantity: 90 }]);
  });
});

describe("linhas da lista de pratos (V7)", () => {
  const dish = (id: string, active = true) => ({ id, name: id, description: "", category: "classics" as const, is_active: active });
  const size = (over: object) => ({ size: "small", costWithoutVat: 1, salePrice: 10, complete: true, missingStockItemIds: [], lines: [{ stockItemId: "x", preparationId: null, name: "x", quantity: 1, baseUnit: "g", wasteFactor: null, unitCostWithoutVat: 1, costWithoutVat: 1, complete: true }], margin: null, ...over });
  const report = {
    salesVatRate: 13,
    ingredients: [],
    missingPrices: [{ stockItemId: "sal", name: "Sal", baseUnit: "g", usedIn: [{ pizzaId: "b", name: "b" }] }, { stockItemId: "oreo", name: "Oreo", baseUnit: "g", usedIn: [{ pizzaId: "inativo", name: "x" }] }],
    dishes: [
      { pizzaId: "a", name: "a", category: "classics", isActive: true, hasActiveRecipe: true, sizes: [size({ margin: { netSalePrice: 8.85, marginWithoutVat: 7.85, marginRatio: 0.887, foodCostRatio: 0.113 } }), size({ size: "large", margin: { netSalePrice: 17.6, marginWithoutVat: 15.6, marginRatio: 0.886, foodCostRatio: 0.114 } })] },
      { pizzaId: "b", name: "b", category: "classics", isActive: true, hasActiveRecipe: true, sizes: [size({ complete: false, missingStockItemIds: ["sal"] })] },
      { pizzaId: "c", name: "c", category: "classics", isActive: true, hasActiveRecipe: false, sizes: [] },
    ],
  };

  it("estado, ingredientes por resolver e intervalo de margem", () => {
    const rows = buildDishRows([dish("a"), dish("b"), dish("c")], report);
    expect(rows.map((r) => [r.dish.id, r.state, r.missingCount])).toEqual([["a", "complete", 0], ["b", "partial", 1], ["c", "no_recipe", 0]]);
    expect(rows[0]!.marginRange).toEqual({ min: 7.85, max: 15.6, minRatio: 0.886, maxRatio: 0.887 });
    expect(rows[1]!.marginRange).toBeNull();
  });

  it("aviso conta só ingredientes de pratos ativos", () => {
    expect(missingSummary(report, new Set(["a", "b", "c"]))).toEqual({ ingredients: 1, dishes: 1 });
  });
});
