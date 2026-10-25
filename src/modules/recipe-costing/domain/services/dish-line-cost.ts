import type { DishCostingDTO } from "../entities/recipe-costing.ts";

/** Artigo de stock ou preparo de uma linha da ficha técnica. */
export type RecipeLineRef = { stockItemId: string } | { preparationId: string };

export interface LineCost {
  costWithoutVat: number;
  /** `false` = falta o preço de algum ingrediente (custo subavaliado). */
  complete: boolean;
}

/**
 * Custo s/ IVA de um artigo/preparo num tamanho da ficha (soma as linhas iguais).
 * `null` quando o relatório ainda não tem essa linha (ex.: acabada de adicionar).
 */
export function lineCostFor(
  dish: DishCostingDTO | null,
  size: string,
  ref: RecipeLineRef,
): LineCost | null {
  const lines = dish?.sizes.find((s) => s.size === size)?.lines ?? [];
  const matching = lines.filter((l) =>
    "stockItemId" in ref
      ? l.stockItemId === ref.stockItemId
      : l.stockItemId == null && l.preparationId === ref.preparationId,
  );
  if (matching.length === 0) return null;
  return {
    costWithoutVat: matching.reduce((sum, l) => sum + l.costWithoutVat, 0),
    complete: matching.every((l) => l.complete),
  };
}

export interface SizeTotal extends LineCost {
  /** PVP tal como está no catálogo; sem percentagem (a taxa de IVA da venda não está modelada). */
  salePrice: number | null;
}

/** Custo total s/ IVA do prato num tamanho, com o PVP ao lado. */
export function sizeTotalFor(
  dish: DishCostingDTO | null,
  size: string,
): SizeTotal | null {
  const s = dish?.sizes.find((x) => x.size === size);
  if (!s || s.lines.length === 0) return null;
  return {
    costWithoutVat: s.costWithoutVat,
    complete: s.complete,
    salePrice: s.salePrice,
  };
}
