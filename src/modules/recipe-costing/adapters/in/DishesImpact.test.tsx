import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RecipeCostingProvider } from "../../recipe-costing.module.tsx";
import type { DishesImpactDTO, DishSizeImpactDTO } from "../../domain/entities/recipe-costing.ts";
import type { RecipeCostingApiPort } from "../../domain/ports/out/recipe-costing-api.port.ts";
import { DishesImpact } from "./DishesImpact.tsx";

// Dados fictícios.
const size = (over: Partial<DishSizeImpactDTO>): DishSizeImpactDTO => ({
  size: "small",
  now: { week: "2026-W44", costWithoutVat: 2.6, complete: true },
  then: { week: "2026-W40", costWithoutVat: 2.5, complete: true },
  comparable: true, change: 0.1, changeRatio: 0.04, mainFactor: { name: "Queijo de teste", diff: 0.08 },
  lines: [
    { name: "Queijo de teste", stockItemId: "q", preparationId: null, quantity: 100, baseUnit: "g", nowCost: 0.82, thenCost: 0.74, diff: 0.08, nowSource: "purchase", thenSource: "purchase", complete: true },
    { name: "Farinha de teste", stockItemId: "f", preparationId: null, quantity: 200, baseUnit: "g", nowCost: 0.2, thenCost: 0.18, diff: 0.02, nowSource: "carried", thenSource: "purchase", complete: true },
  ],
  ...over,
});

const DATA: DishesImpactDTO = {
  method: "Ficha técnica atual aplicada aos preços de compra de cada semana (reconstruído)",
  now: { week: "2026-W44", weekStart: "2026-10-26" },
  then: { week: "2026-W40", weekStart: "2026-09-28" },
  dishes: [
    { pizzaId: "a", name: "Pizza Alfa", category: "classic", isActive: true, versionFrom: "2026-10-01T00:00:00.000Z", sizes: [size({})] },
    {
      pizzaId: "b", name: "Pizza Beta", category: "classic", isActive: true, versionFrom: "2026-10-01T00:00:00.000Z",
      sizes: [size({ comparable: false, change: null, changeRatio: null, mainFactor: null, then: { week: "2026-W40", costWithoutVat: 1, complete: false } })],
    },
    { pizzaId: "c", name: "Pizza Inativa", category: "classic", isActive: false, versionFrom: "2026-10-01T00:00:00.000Z", sizes: [size({})] },
  ],
};

function renderWith(getDishesImpact = vi.fn(async () => DATA)) {
  const api = { getDishesImpact } as unknown as RecipeCostingApiPort;
  render(
    <RecipeCostingProvider module={{ api }}>
      <DishesImpact categoryLabels={{ classic: "Clássica" }} />
    </RecipeCostingProvider>,
  );
  return getDishesImpact;
}

describe("Impacto nas pizzas (V6 §8)", () => {
  it("variação, fator principal, não comparável e método; sem margem", async () => {
    renderWith();
    const alfa = (await screen.findByText("Pizza Alfa")).closest("tr")!;
    expect(within(alfa).getByText("Clássica")).toBeTruthy();
    expect(within(alfa).getByText(/\+4%/)).toBeTruthy();
    expect(within(alfa).getByText(/Queijo de teste/)).toBeTruthy();
    const beta = screen.getByText("Pizza Beta").closest("tr")!;
    expect(within(beta).getByText("Não comparável")).toBeTruthy();
    expect(screen.getByText(/reconstruído/)).toBeTruthy();
    expect(screen.queryByText("Pizza Inativa")).toBeNull();
    expect(screen.queryByRole("columnheader", { name: /margem/i })).toBeNull();
  });

  it("expandir mostra a diferença por ingrediente; mudar o período pede outra comparação", async () => {
    const get = renderWith();
    fireEvent.click(await screen.findByText("Pizza Alfa"));
    expect(screen.getByText("Farinha de teste")).toBeTruthy();
    expect(screen.getByText("(transportado)")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "8 sem." }));
    expect(get).toHaveBeenLastCalledWith(8);
  });
});
