/**
 * Unidade em que as pessoas pensam o preço (€/kg, €/l) para uma unidade base
 * de stock (g, ml, cl). `factor` = quantas unidades base cabem numa unidade de preço.
 */
export function pricingUnit(baseUnit: string): { label: string; factor: number } {
  switch (baseUnit) {
    case "g":
      return { label: "kg", factor: 1000 };
    case "ml":
      return { label: "l", factor: 1000 };
    case "cl":
      return { label: "l", factor: 100 };
    default:
      return { label: baseUnit, factor: 1 };
  }
}

/** Custo por unidade base → custo por unidade de preço (ex.: €/g → €/kg). */
export function toPricingUnitCost(unitCost: number, baseUnit: string): number {
  return unitCost * pricingUnit(baseUnit).factor;
}

/** Custo por unidade de preço introduzido pela pessoa → custo por unidade base (o que o catálogo guarda). */
export function fromPricingUnitCost(pricingCost: number, baseUnit: string): number {
  return pricingCost / pricingUnit(baseUnit).factor;
}
