import type { PurchasePresentationDTO, StockItemDTO, StockSituation } from "../entities/stock-catalog.ts";

/** Mesmo limiar do ecrã anterior: «próximo do mínimo» até 20% acima do mínimo. */
export const NEAR_MIN_FACTOR = 1.2;

/**
 * Situação do stock (V6 §3): só para o que acrescenta valor. Sem movimentos ≠ 0; sem mínimo nunca é
 * «abaixo do mínimo» (só «Sem stock» se a quantidade for 0 ou negativa).
 */
export function situation(item: Pick<StockItemDTO, "is_active" | "current_quantity" | "min_stock" | "has_movements">): StockSituation {
  if (!item.is_active) return "inactive";
  if (item.has_movements === false || item.current_quantity == null) return "no_data";
  const qty = item.current_quantity;
  const min = item.min_stock ?? 0;
  if (qty <= 0) return "out";
  if (min > 0 && qty < min) return "below";
  if (min > 0 && qty < min * NEAR_MIN_FACTOR) return "near";
  return "ok";
}

/** Em falta = max(mínimo − stock, 0); null sem mínimo definido (nada a repor por regra). */
export function deficit(item: Pick<StockItemDTO, "current_quantity" | "min_stock">): number | null {
  const min = item.min_stock ?? 0;
  if (!(min > 0)) return null;
  return Math.max(min - (item.current_quantity ?? 0), 0);
}

const UNITS: Record<string, { dim: "mass" | "volume" | "count"; f: number }> = {
  g: { dim: "mass", f: 1 }, kg: { dim: "mass", f: 1000 }, ml: { dim: "volume", f: 1 }, cl: { dim: "volume", f: 10 }, l: { dim: "volume", f: 1000 }, un: { dim: "count", f: 1 },
};
export function unitFactor(from: string, to: string): number | null {
  const a = UNITS[from.toLowerCase()], b = UNITS[to.toLowerCase()];
  return a && b && a.dim === b.dim ? a.f / b.f : null;
}

export type ReplenishmentSuggestion =
  | { status: "none" }
  | { status: "to_confirm"; reason: string }
  | { status: "ok"; packages: number; packageUnit: string | null; contentQuantity: number; contentUnit: string; quantityBase: number; surplusBase: number };

/**
 * Sugestão de compra (V6 §5) com a embalagem confirmada: embalagens inteiras (ceil ao incremento,
 * respeita o mínimo). Sem embalagem confirmada ou conversão impossível → «Por confirmar» (nunca
 * supõe 1 un = 1 kg). Só sugestão: não cria compras nem movimentos.
 */
export function replenishment(missing: number | null, baseUnit: string, presentation: PurchasePresentationDTO | null): ReplenishmentSuggestion {
  if (missing === null || !(missing > 0)) return { status: "none" };
  if (!presentation) return { status: "to_confirm", reason: "Sem embalagem de compra confirmada" };
  const toBase = unitFactor(presentation.contentUnit, baseUnit);
  if (toBase === null || !(presentation.contentQuantity > 0)) return { status: "to_confirm", reason: "Embalagem noutra unidade" };
  const perPackage = presentation.contentQuantity * toBase;
  const step = Math.max(presentation.orderIncrementPackages || 1, 1);
  const steps = Math.ceil(missing / perPackage / step - 1e-9);
  const packages = Math.max(presentation.minOrderPackages || 1, steps * step);
  const quantityBase = packages * perPackage;
  return { status: "ok", packages, packageUnit: presentation.packageUnit, contentQuantity: presentation.contentQuantity, contentUnit: presentation.contentUnit, quantityBase, surplusBase: quantityBase - missing };
}

/** Embalagem a usar: do fornecedor habitual (última compra); sem esse, a única confirmada para o artigo. */
export function presentationFor(itemId: string, supplierId: string | null, all: PurchasePresentationDTO[]): PurchasePresentationDTO | null {
  const mine = all.filter((p) => p.stockItemId === itemId);
  return (supplierId ? mine.find((p) => p.supplierId === supplierId) : undefined) ?? (mine.length === 1 ? mine[0]! : null);
}
