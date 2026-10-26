/**
 * Custos e quantidades para leitura (V6 §3): moeda E denominador sempre (€/kg, €/l, €/un) e nunca
 * «0,00 €» para um custo pequeno — mais casas decimais quando é preciso.
 */
const PRICE_UNIT: Record<string, { label: string; factor: number }> = {
  g: { label: "kg", factor: 1000 },
  ml: { label: "l", factor: 1000 },
  cl: { label: "l", factor: 100 },
};

export function priceUnit(baseUnit: string): { label: string; factor: number } {
  return PRICE_UNIT[baseUnit] ?? { label: baseUnit, factor: 1 };
}

/** Cêntimos por unidade base → € por unidade de preço (ex.: 0,558 c/g → 5,58 €/kg). */
export function toPriceUnitEuros(centsPerBaseUnit: number, baseUnit: string): number {
  return (centsPerBaseUnit * priceUnit(baseUnit).factor) / 100;
}

/** «5,58 €/kg»; valores pequenos com as casas necessárias («0,0042 €/un»), nunca «0,00 €». */
export function formatUnitCost(centsPerBaseUnit: number, baseUnit: string): string {
  const eur = toPriceUnitEuros(centsPerBaseUnit, baseUnit);
  const digits = eur === 0 ? 2 : eur < 0.01 ? 4 : eur < 0.1 ? 3 : 2;
  return `${eur.toLocaleString("pt-PT", { style: "currency", currency: "EUR", minimumFractionDigits: digits, maximumFractionDigits: Math.max(digits, 4) })}/${priceUnit(baseUnit).label}`;
}

/** Quantidade legível: grandes quantidades em kg/l (8 450 g → 8,45 kg). */
export function formatQuantity(value: number, baseUnit: string): string {
  const big = (baseUnit === "g" || baseUnit === "ml") && Math.abs(value) >= 1000;
  const v = big ? value / 1000 : value;
  const unit = big ? (baseUnit === "g" ? "kg" : "l") : baseUnit;
  return `${v.toLocaleString("pt-PT", { maximumFractionDigits: big ? 2 : 3 })} ${unit}`;
}

export const formatPct = (r: number) => `${r > 0 ? "+" : ""}${(r * 100).toLocaleString("pt-PT", { maximumFractionDigits: 1 })}%`;
export const formatDate = (ymd: string) => ymd.slice(0, 10).split("-").reverse().join("/");
