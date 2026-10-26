import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StockCatalogProvider } from "../../stock-catalog.module.tsx";
import type { StockItemDTO } from "../../domain/entities/stock-catalog.ts";
import type { StockCatalogApiPort } from "../../domain/ports/out/stock-catalog-api.port.ts";
import { ArticlesView } from "./ArticlesView.tsx";

// Dados fictícios.
const item = (over: Partial<StockItemDTO>): StockItemDTO => ({
  id: "x", name: "Artigo", sku: null, category_id: "c1", type: "ingredient", base_unit: "g", min_stock: 0, is_active: true,
  current_quantity: 0, has_movements: true, purchase_reference_unit_cost_without_vat: null, ...over,
});

const ITEMS: StockItemDTO[] = [
  item({ id: "moz", name: "Queijo de teste", min_stock: 5000, current_quantity: 2000 }),
  item({ id: "far", name: "Farinha de teste", base_unit: "kg", min_stock: 10, current_quantity: 40 }),
  item({ id: "nov", name: "Molho novo", has_movements: false, current_quantity: null }),
];

function renderView(onEdit = vi.fn()) {
  const api: StockCatalogApiPort = {
    listItems: async () => ITEMS,
    listCategories: async () => [{ id: "c1", name: "Mercearia" }],
    getCostOverview: async () => ({
      referenceMethod: "Média ponderada",
      weeks: ["2026-W42", "2026-W43"],
      items: [
        {
          stockItemId: "moz",
          lastPurchase: { invoiceDate: "2026-10-20", supplierId: "s1", supplierName: "Fornecedor Teste", centsPerUnit: 0.82 },
          reference: { centsPerUnit: 0.8, from: "2026-07-27", to: "2026-10-19", purchases: 3 },
          changeRatio: 0.025,
          weekly: [0.8, 0.82],
          purchases: 4,
        },
      ],
    }),
    listPresentations: async () => [],
    listMovements: async () => [],
    listPurchases: async () => [],
  };
  render(
    <StockCatalogProvider module={{ api }}>
      <ArticlesView canManage reloadKey={0} headerActions={null} onEdit={onEdit} renderPriceHistory={() => <p>histórico</p>} />
    </StockCatalogProvider>,
  );
}

describe("Artigos e ingredientes (V6)", () => {
  it("Geral: situação, «Sem movimentos» ≠ stock 0 e custo só de compras confirmadas", async () => {
    renderView();
    const moz = (await screen.findByText("Queijo de teste")).closest("tr")!;
    expect(within(moz).getByText("Abaixo do mínimo")).toBeTruthy();
    expect(within(moz).getByText(/8,20/)).toBeTruthy(); // 0,82 cêntimos/g → 8,20 €/kg
    const nov = screen.getByText("Molho novo").closest("tr")!;
    expect(within(nov).getByText("Sem movimentos")).toBeTruthy();
    expect(within(nov).getByText("Sem custo conhecido")).toBeTruthy();
  });

  it("Reposição mostra só o que está em falta", async () => {
    renderView();
    await screen.findByText("Queijo de teste");
    fireEvent.click(screen.getByRole("tab", { name: "Reposição" }));
    expect(screen.getByText("Queijo de teste")).toBeTruthy();
    expect(screen.queryByText("Farinha de teste")).toBeNull();
    expect(screen.queryByText("Molho novo")).toBeNull();
  });

  it("Custos: referência, variação e histórico insuficiente", async () => {
    renderView();
    await screen.findByText("Queijo de teste");
    fireEvent.click(screen.getByRole("tab", { name: "Custos" }));
    const moz = screen.getByText("Queijo de teste").closest("tr")!;
    expect(within(moz).getByText(/\+2,5/)).toBeTruthy();
    const far = screen.getByText("Farinha de teste").closest("tr")!;
    expect(within(far).getByText("Histórico insuficiente")).toBeTruthy();
  });

  it("clicar na linha abre o painel do artigo; Esc fecha", async () => {
    renderView();
    fireEvent.click(await screen.findByText("Farinha de teste"));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Farinha de teste")).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("menu ⋯ → Editar entrega o artigo ao formulário existente", async () => {
    const onEdit = vi.fn();
    renderView(onEdit);
    await screen.findByText("Farinha de teste");
    fireEvent.click(screen.getByRole("button", { name: "Ações de Farinha de teste" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Editar" }));
    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ id: "far" }));
  });
});
