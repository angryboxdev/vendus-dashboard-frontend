import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RecipeCostingProvider } from "../../recipe-costing.module.tsx";
import type { WeeklyDishCostDTO, WeeklyDishCostPointDTO } from "../../domain/entities/recipe-costing.ts";
import type { RecipeCostingApiPort } from "../../domain/ports/out/recipe-costing-api.port.ts";
import { DishWeeklyCost } from "./DishWeeklyCost.tsx";

const point = (over: Partial<WeeklyDishCostPointDTO>): WeeklyDishCostPointDTO => ({
  week: "2026-W41", weekStart: "2026-10-05", partial: false, status: "ok", versionFrom: "2026-10-26T10:00:00.000Z", costWithoutVat: 1, changeRatio: null, lines: [], ...over,
});

function renderWith(data: WeeklyDishCostDTO) {
  const api = { getDishWeeklyCost: async () => data } as unknown as RecipeCostingApiPort;
  render(
    <RecipeCostingProvider module={{ api }}>
      <DishWeeklyCost pizzaId={data.pizzaId} />
    </RecipeCostingProvider>,
  );
}

describe("Evolução semanal do custo da pizza (V5 §6.3)", () => {
  it("sem versões da ficha: indica que o histórico começa na próxima alteração", async () => {
    renderWith({ pizzaId: "p", name: "Margherita", firstVersionAt: null, sizes: [] });
    expect(await screen.findByText(/Sem versão histórica da ficha técnica/)).toBeTruthy();
  });

  it("custo atual, semanas sem versão, marcadores e detalhe por ingrediente; separadores por tamanho", async () => {
    renderWith({
      pizzaId: "p", name: "Margherita", firstVersionAt: "2026-10-12T10:00:00.000Z",
      sizes: [
        {
          size: "small",
          weeks: [
            point({ week: "2026-W41", weekStart: "2026-10-05", status: "no_version", versionFrom: null, costWithoutVat: null }),
            point({ week: "2026-W42", weekStart: "2026-10-12", costWithoutVat: 2.5 }),
            point({
              week: "2026-W43", weekStart: "2026-10-19", partial: true, costWithoutVat: 2.6, changeRatio: 0.04,
              lines: [
                { stockItemId: "ch", preparationId: null, name: "Cheddar", quantity: 100, baseUnit: "g", costWithoutVat: 0.779, source: "carried", complete: true },
                { stockItemId: null, preparationId: "mix", name: "Mix de Queijos", quantity: 100, baseUnit: null, costWithoutVat: 0.5817, source: "purchase", complete: true },
              ],
            }),
          ],
        },
        { size: "large", weeks: [point({ week: "2026-W43", costWithoutVat: 4.1 })] },
      ],
    });
    expect(await screen.findByText(/Atual:/)).toBeTruthy();
    expect(screen.getByText("Sem versão histórica")).toBeTruthy();
    expect(screen.getByText(/em curso · preço transportado/)).toBeTruthy();
    fireEvent.click(screen.getByText("2026-W43"));
    expect(screen.getByText(/Cheddar · 100 g/)).toBeTruthy();
    expect(screen.getByText(/Mix de Queijos · 100 \(preparo\)/)).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "Grande" }));
    expect(screen.getByText(/4,10\s€/, { selector: "span" })).toBeTruthy();
  });
});
