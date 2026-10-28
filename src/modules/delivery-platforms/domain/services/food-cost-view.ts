import type { FoodCostLine, PackagingLine, ProductMappingChange, ResolvedTarget } from "../entities/food-cost.ts";

export const SIZE_LABELS: Record<string, string> = { xs: "XS", small: "Pequena", large: "Grande" };
const SIZES = ["small", "large", "xs"];

/** Valor da escolha num `<select>`: «auto» (sugestão), «dish:<id>:<tamanho>», «item:<id>», «upgrade», «ignore». */
export function targetValue(t: ResolvedTarget | null): string {
  if (!t || t.source === "auto") return "auto";
  if (t.targetType === "dish") return `dish:${t.pizzaId}:${t.size}`;
  if (t.targetType === "item") return `item:${t.stockItemId}`;
  return t.targetType === "upgrade_large" ? "upgrade" : "ignore";
}

/** Opções de pratos (cada um nos três tamanhos). */
export function dishOptions(dishes: { pizzaId: string; name: string }[]): { value: string; label: string }[] {
  return dishes.flatMap((d) => SIZES.map((s) => ({ value: `dish:${d.pizzaId}:${s}`, label: `${d.name} (${SIZE_LABELS[s]})` })));
}

/** A escolha do `<select>` como correção a gravar. */
export function changeFor(line: Pick<FoodCostLine, "productKey" | "code" | "description">, value: string): ProductMappingChange {
  const base = { productKey: line.productKey, productCode: line.code || null, productDescription: line.description };
  if (value === "auto") return { ...base, targetType: null };
  if (value === "upgrade") return { ...base, targetType: "upgrade_large" };
  if (value === "ignore") return { ...base, targetType: "ignore" };
  const [kind, id, size] = value.split(":");
  return kind === "dish" ? { ...base, targetType: "dish", pizzaId: id ?? null, size: size ?? null } : { ...base, targetType: "item", stockItemId: id ?? null };
}

/** Correção do artigo de uma embalagem; «auto» volta ao artigo pelo nome. */
export function packagingChange(p: Pick<PackagingLine, "key" | "label">, value: string): ProductMappingChange {
  const base = { productKey: p.key, productCode: null, productDescription: p.label };
  return value === "auto" ? { ...base, targetType: null } : { ...base, targetType: "item", stockItemId: value };
}
