import { describe, expect, it } from "vitest";
import type {
  DishCostingDTO,
  DishLineCostDTO,
} from "../entities/recipe-costing.ts";
import { lineCostFor, sizeTotalFor } from "./dish-line-cost.ts";

const line = (partial: Partial<DishLineCostDTO>): DishLineCostDTO => ({
  stockItemId: null,
  preparationId: null,
  name: "",
  quantity: 1,
  baseUnit: null,
  wasteFactor: null,
  unitCostWithoutVat: null,
  costWithoutVat: 0,
  complete: true,
  ...partial,
});

const dish: DishCostingDTO = {
  pizzaId: "p1",
  name: "Margherita",
  category: "classics",
  isActive: true,
  hasActiveRecipe: true,
  sizes: [
    {
      size: "small",
      costWithoutVat: 1.6,
      salePrice: 8,
      complete: false,
      missingStockItemIds: ["tomate"],
      lines: [
        line({ stockItemId: "queijo", name: "Queijo", costWithoutVat: 1.1 }),
        line({
          preparationId: "molho",
          name: "Molho",
          costWithoutVat: 0.5,
          complete: false,
        }),
      ],
    },
    {
      size: "large",
      costWithoutVat: 0,
      salePrice: null,
      complete: true,
      missingStockItemIds: [],
      lines: [],
    },
  ],
};

describe("custo por linha da ficha técnica", () => {
  it("encontra o custo do artigo e do preparo por tamanho", () => {
    expect(lineCostFor(dish, "small", { stockItemId: "queijo" })).toEqual({
      costWithoutVat: 1.1,
      complete: true,
    });
    expect(lineCostFor(dish, "small", { preparationId: "molho" })).toEqual({
      costWithoutVat: 0.5,
      complete: false,
    });
    expect(lineCostFor(dish, "large", { stockItemId: "queijo" })).toBeNull();
    expect(lineCostFor(null, "small", { stockItemId: "queijo" })).toBeNull();
  });

  it("total do tamanho com o PVP; sem linhas não há total", () => {
    expect(sizeTotalFor(dish, "small")).toEqual({
      costWithoutVat: 1.6,
      complete: false,
      salePrice: 8,
    });
    expect(sizeTotalFor(dish, "large")).toBeNull();
  });
});
