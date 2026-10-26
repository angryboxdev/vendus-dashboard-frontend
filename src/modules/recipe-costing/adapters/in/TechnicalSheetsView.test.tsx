import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RecipeCostingProvider } from "../../recipe-costing.module.tsx";
import type { RecipeCostingReportDTO } from "../../domain/entities/recipe-costing.ts";
import type { RecipeCostingApiPort } from "../../domain/ports/out/recipe-costing-api.port.ts";
import type { TechnicalSheetsApiPort } from "../../domain/ports/out/technical-sheets-api.port.ts";
import type { RecipeItemDTO } from "../../domain/entities/technical-sheets.ts";
import { TechnicalSheetsView, type SheetsTab } from "./TechnicalSheetsView.tsx";

// Dados fictícios.
const line = (over: object) => ({ stockItemId: "creme", preparationId: null, name: "Creme doce", quantity: 70, baseUnit: "g", wasteFactor: null, unitCostWithoutVat: 0.01, costWithoutVat: 0.7, complete: true, ...over });
const report: RecipeCostingReportDTO = {
  salesVatRate: 13,
  ingredients: [{ stockItemId: "creme", name: "Creme doce", baseUnit: "g", unitCostWithoutVat: 0.01, source: "manual" }],
  missingPrices: [{ stockItemId: "sal", name: "Sal", baseUnit: "g", usedIn: [{ pizzaId: "salgado", name: "Prato Salgado" }] }],
  preparations: [{ preparationId: "massa", name: "Massa", yieldQty: 214, useAsUnit: true, itemCount: 2, batchCostWithoutVat: 0.26, complete: true }],
  dishes: [
    {
      pizzaId: "doce", name: "Doce Teste", category: "sweeties", isActive: true, hasActiveRecipe: true,
      sizes: [
        { size: "small", costWithoutVat: 0.7, salePrice: 8.9, complete: true, missingStockItemIds: [], lines: [line({})], margin: { netSalePrice: 7.876, marginWithoutVat: 7.176, marginRatio: 0.911, foodCostRatio: 0.089 } },
        { size: "large", costWithoutVat: 1.4, salePrice: 14.9, complete: true, missingStockItemIds: [], lines: [line({ quantity: 140, costWithoutVat: 1.4 })], margin: { netSalePrice: 13.186, marginWithoutVat: 11.786, marginRatio: 0.894, foodCostRatio: 0.106 } },
      ],
    },
    { pizzaId: "salgado", name: "Prato Salgado", category: "classics", isActive: true, hasActiveRecipe: true, sizes: [{ size: "small", costWithoutVat: 1, salePrice: 9.9, complete: false, missingStockItemIds: ["sal"], lines: [line({ stockItemId: "sal", name: "Sal", complete: false })], margin: null }] },
  ],
};
const items: RecipeItemDTO[] = [
  { id: "s1", recipe_id: "r1", stock_item_id: "creme", preparation_id: null, size: "small", quantity: 70, waste_factor: null },
  { id: "l1", recipe_id: "r1", stock_item_id: "creme", preparation_id: null, size: "large", quantity: 140, waste_factor: null },
];

function setup(tab: SheetsTab = "dishes") {
  const sheets = {
    listDishes: async () => [
      { id: "doce", name: "Doce Teste", description: "", category: "sweeties", is_active: true },
      { id: "salgado", name: "Prato Salgado", description: "", category: "classics", is_active: true },
    ],
    listPreparations: async () => [{ id: "massa", name: "Massa", description: null, yield_qty: 214, yield_unit: "g", use_as_unit: true, is_active: true }],
    listStockItems: async () => [{ id: "creme", name: "Creme doce", base_unit: "g", is_active: true }],
    getActiveRecipe: async () => ({ recipe: { id: "r1", pizza_id: "doce", version: 3, is_active: true, notes: null }, items }),
    listPrices: async () => [{ id: "p1", pizza_id: "doce", size: "small", price: 8.9 }, { id: "p2", pizza_id: "doce", size: "large", price: 14.9 }],
    addRecipeItem: vi.fn(async () => items[0]!),
    updateRecipeItem: vi.fn(async () => items[0]!),
    deleteRecipeItem: vi.fn(async () => undefined),
  } as unknown as TechnicalSheetsApiPort;
  const api = { getReport: async () => report, getDishesImpact: async () => ({ method: "", now: { week: "2026-W44", weekStart: "2026-10-26" }, then: { week: "2026-W40", weekStart: "2026-09-28" }, dishes: [] }), getDishWeeklyCost: async () => ({ pizzaId: "doce", name: "Doce Teste", firstVersionAt: null, sizes: [] }) } as unknown as RecipeCostingApiPort;
  const onResolveMissing = vi.fn();
  render(
    <RecipeCostingProvider module={{ api, sheets }}>
      <TechnicalSheetsView tab={tab} onTab={() => {}} canManage onOpenArticle={() => {}} onResolveMissing={onResolveMissing} />
    </RecipeCostingProvider>,
  );
  return { sheets, onResolveMissing };
}

describe("Fichas técnicas (V7)", () => {
  it("uma linha por prato com variantes, margem e PVP; aviso compacto leva a Artigos", async () => {
    const { onResolveMissing } = setup();
    const doce = (await screen.findByText("Doce Teste")).closest("tr")!;
    expect(within(doce).getByText("2 variantes")).toBeTruthy();
    expect(within(doce).getByText("Completo")).toBeTruthy();
    expect(within(doce).getByText(/7,18\s€ – 11,79\s€/)).toBeTruthy();
    const salgado = screen.getByText("Prato Salgado").closest("tr")!;
    expect(within(salgado).getByText(/Parcial · 1 sem custo/)).toBeTruthy();
    expect(screen.getByText(/1 ingrediente sem custo conhecido/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Resolver em Artigos e ingredientes" }));
    expect(onResolveMissing).toHaveBeenCalled();
    expect(screen.getByText(/IVA das vendas:/)).toBeTruthy();
  });

  it("doce sem XS: «Adicionar variante XS» cria cada linha com metade da Pequena", async () => {
    const { sheets } = setup();
    fireEvent.click(await screen.findByText("Doce Teste"));
    fireEvent.click(await screen.findByRole("button", { name: /Adicionar variante XS/ }));
    await waitFor(() => expect(sheets.addRecipeItem).toHaveBeenCalledWith("doce", "r1", { stock_item_id: "creme" }, "xs", 35));
  });

  it("separador Preparações mostra rendimento e custo por unidade", async () => {
    setup("preparations");
    const row = (await screen.findByText("Massa")).closest("tr")!;
    expect(within(row).getByText(/214\sg/)).toBeTruthy();
    expect(within(row).getByText(/0,26\s€\/un/)).toBeTruthy();
  });
});
