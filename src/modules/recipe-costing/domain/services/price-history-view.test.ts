import { describe, expect, it } from "vitest";
import type { IngredientPriceHistoryDTO, WeeklyPricePointDTO } from "../entities/recipe-costing.ts";
import { observationPrice, priceChartPoints } from "./price-history-view.ts";

const week = (over: Partial<WeeklyPricePointDTO>): WeeklyPricePointDTO => ({
  week: "2026-W41", weekStart: "2026-10-05", quantity: 0, netCents: 0, avgCentsPerUnit: null, carriedCentsPerUnit: null, carriedFromWeek: null,
  changeRatio: null, partial: false, observations: [], ...over,
});

describe("vista do histórico de preços (V5 §5.3)", () => {
  it("cêntimos/g → €/kg; compra real vs preço transportado vs sem preço", () => {
    const history: IngredientPriceHistoryDTO = {
      stockItemId: "mozz", name: "Mozzarela Ralado", baseUnit: "g", lastPurchase: null,
      weeks: [
        week({ week: "2026-W40" }),
        week({ week: "2026-W41", quantity: 60000, avgCentsPerUnit: 0.558 }),
        week({ week: "2026-W42", carriedCentsPerUnit: 0.558, carriedFromWeek: "2026-W41", partial: true }),
      ],
    };
    const { unit, points } = priceChartPoints(history);
    expect(unit).toBe("kg");
    expect(points.map((p) => [p.week, p.value, p.kind])).toEqual([["2026-W40", null, "none"], ["2026-W41", 5.58, "purchase"], ["2026-W42", 5.58, "carried"]]);
    expect(points[2]!.partial).toBe(true);
  });

  it("preço de uma linha: 4674 cêntimos por 6000 g = 7,79 €/kg; quantidade 0 → sem preço", () => {
    expect(observationPrice(4674, 6000, "g")).toBeCloseTo(7.79, 6);
    expect(observationPrice(100, 0, "g")).toBeNull();
  });
});
