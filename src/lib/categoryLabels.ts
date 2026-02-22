import type { Category } from "../types/monthlySummary";

export const CATEGORY_LABELS: Array<{ key: Category; label: string }> = [
  { key: "pizza", label: "Pizzas" },
  { key: "bebida_alcoolica", label: "Bebidas alcoólicas" },
  { key: "bebida_nao_alcoolica", label: "Bebidas não alcoólicas" },
  { key: "sacos", label: "Sacos / Embalagem" },
  { key: "outros", label: "Outros" },
];

export function categoryLabel(cat: Category) {
  return CATEGORY_LABELS.find((c) => c.key === cat)?.label ?? cat;
}
