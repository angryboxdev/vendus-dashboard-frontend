import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RecipeCostingProvider } from "../../recipe-costing.module.tsx";
import type { IngredientPriceHistoryDTO, WeeklyPricePointDTO } from "../../domain/entities/recipe-costing.ts";
import type { RecipeCostingApiPort } from "../../domain/ports/out/recipe-costing-api.port.ts";
import { IngredientPriceHistory } from "./IngredientPriceHistory.tsx";

const week = (over: Partial<WeeklyPricePointDTO>): WeeklyPricePointDTO => ({
  week: "2026-W40", weekStart: "2026-09-28", quantity: 0, netCents: 0, avgCentsPerUnit: null, carriedCentsPerUnit: null, carriedFromWeek: null,
  changeRatio: null, partial: false, observations: [], ...over,
});

function renderWith(history: IngredientPriceHistoryDTO) {
  const api = { getPriceHistory: async () => history } as unknown as RecipeCostingApiPort;
  render(
    <RecipeCostingProvider module={{ api }}>
      <IngredientPriceHistory stockItemId={history.stockItemId} />
    </RecipeCostingProvider>,
  );
}

describe("Evolução do preço de compra (V5 §5.3)", () => {
  it("sem compras: custo indisponível (nunca zero)", async () => {
    renderWith({ stockItemId: "x", name: "Novo", baseUnit: "g", weeks: [week({})], lastPurchase: null });
    expect(await screen.findByText(/Custo indisponível/)).toBeTruthy();
  });

  it("última compra, semana com variação e, ao escolher a semana, as faturas com desconto e €/kg", async () => {
    renderWith({
      stockItemId: "cheddar", name: "Cheddar Ralado", baseUnit: "g",
      lastPurchase: { invoiceDate: "2026-10-05", supplierName: "Fornecedor Exemplo", centsPerUnit: 0.779 },
      weeks: [
        week({ week: "2026-W40", quantity: 1000, netCents: 750, avgCentsPerUnit: 0.75 }),
        week({
          week: "2026-W41", weekStart: "2026-10-05", quantity: 7000, netCents: 5453, avgCentsPerUnit: 0.779, changeRatio: 0.0387,
          observations: [
            { lineId: "a", supplierName: "Fornecedor Exemplo", invoiceNumber: "FT 1/63388", invoiceDate: "2026-10-05", quantity: 6000, grossCents: 4920, discountCents: 246, netCents: 4674 },
            { lineId: "b", supplierName: "Fornecedor Exemplo", invoiceNumber: "FT 1/63388", invoiceDate: "2026-10-05", quantity: 1000, grossCents: 820, discountCents: 41, netCents: 779 },
          ],
        }),
        week({ week: "2026-W42", weekStart: "2026-10-12", carriedCentsPerUnit: 0.779, carriedFromWeek: "2026-W41", partial: true }),
      ],
    });
    expect(await screen.findByText(/Última compra: 7,79\s€\/kg · 05\/10\/2026/)).toBeTruthy();
    expect(screen.getByText(/Esta semana: sem nova compra \(referência de 2026-W41\)/)).toBeTruthy();
    expect(screen.getByText("+3,9%")).toBeTruthy();
    fireEvent.click(screen.getByText("2026-W41"));
    expect(screen.getAllByText(/desconto 2,46\s€ · líquido 46,74\s€ · 7,79\s€\/kg/)).toHaveLength(1);
    expect(screen.getByText(/1 semanas? sem nova compra|1 sem nova compra/)).toBeTruthy();
  });
});
