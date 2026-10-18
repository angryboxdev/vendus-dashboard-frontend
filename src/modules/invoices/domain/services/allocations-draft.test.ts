import { describe, expect, test } from "vitest";
import { allocationsPayload, allocationsState, hasMixedCategories, proposeFromLines, type DraftAllocation } from "./allocations-draft.ts";

const row = (description: string, categoryId: string, amount: string): DraftAllocation => ({ key: description, description, groupId: null, categoryId, locationId: null, amount });
const makro = [row("Bebidas", "bebidas", "100"), row("Equipamentos", "equip", "250"), row("Ingredientes", "ingred", "300")];

describe("Repartições «Por valores» (F2 §2.2)", () => {
  test("100 + 250 + 300 = 650 € de base líquida: nada por distribuir", () => {
    expect(allocationsState(makro, 65000)).toEqual({ distributedCents: 65000, remainingCents: 0, rowsComplete: true, ok: true });
  });

  test("649 € ou 651 € bloqueiam (por distribuir ±1 €)", () => {
    expect(allocationsState([...makro.slice(0, 2), row("Ingredientes", "ingred", "299")], 65000)).toMatchObject({ remainingCents: 100, ok: false });
    expect(allocationsState([...makro.slice(0, 2), row("Ingredientes", "ingred", "301")], 65000)).toMatchObject({ remainingCents: -100, ok: false });
  });

  test("mudar o desconto/base reabre a conferência (sem redistribuir)", () => {
    expect(allocationsState(makro, 60000)).toMatchObject({ remainingCents: -5000, ok: false });
  });

  test("linha incompleta (sem subcategoria ou montante) impede lançar", () => {
    expect(allocationsState([row("Sem categoria", "", "650")].map((r) => ({ ...r, categoryId: null })), 65000).ok).toBe(false);
    expect(allocationsPayload([...makro, { ...row("Vazia", "x", ""), categoryId: "x" }])).toHaveLength(3);
  });

  test("propor a partir das linhas: soma por subcategoria; linhas sem subcategoria ficam por distribuir", () => {
    const proposal = proposeFromLines(
      [
        { key: "a", categoryId: "bebidas", locationId: "mbs", netCents: 6000 },
        { key: "b", categoryId: "bebidas", locationId: "mbs", netCents: 4000 },
        { key: "c", categoryId: "ingred", locationId: null, netCents: 30000 },
        { key: "d", categoryId: null, locationId: null, netCents: 25000 },
      ],
      [{ id: "bebidas", groupId: "cmv", name: "Bebidas" }, { id: "ingred", groupId: "cmv", name: "Ingredientes" }],
    );
    expect(proposal.map((p) => [p.description, p.amount, p.locationId])).toEqual([["Bebidas", "100.00", "mbs"], ["Ingredientes", "300.00", null]]);
    expect(allocationsState(proposal, 65000).remainingCents).toBe(25000);
  });

  test("mistura de subcategorias deteta-se pelas linhas", () => {
    expect(hasMixedCategories([{ categoryId: "a" }, { categoryId: "b" }])).toBe(true);
    expect(hasMixedCategories([{ categoryId: "a" }, { categoryId: null }])).toBe(false);
  });
});
