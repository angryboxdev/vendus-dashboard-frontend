import { VARIANTS, type DishCategory, type RecipeItemDTO, type Variant } from "../entities/technical-sheets.ts";

/** Só as doces têm XS (decisão do utilizador, V7). */
export function allowsXs(category: DishCategory | string): boolean {
  return category === "sweeties";
}

/** XS = exatamente metade da Pequena (arredondado a 3 casas, a precisão das quantidades). */
export function xsQuantity(smallQuantity: number): number {
  return Math.round((smallQuantity / 2) * 1000) / 1000;
}

/** Variantes que um prato tem: as que têm PVP ou linhas na ficha, pela ordem XS → Pequena → Grande. */
export function dishVariants(items: Pick<RecipeItemDTO, "size">[], priceSizes: string[]): Variant[] {
  const present = new Set<string>([...items.map((i) => i.size), ...priceSizes]);
  const out = VARIANTS.filter((v) => present.has(v));
  return out.length ? out : ["small", "large"];
}

export interface CompositionRow {
  key: string;
  ref: { stock_item_id: string } | { preparation_id: string };
  kind: "stock" | "preparation";
  entityId: string;
  /** Linha da ficha em cada variante (`null` = não existe nessa variante). */
  bySize: Partial<Record<Variant, RecipeItemDTO>>;
}

/** Uma linha por componente com as quantidades de cada variante; preparações primeiro, depois a ordem da ficha. */
export function compositionRows(items: RecipeItemDTO[]): CompositionRow[] {
  const map = new Map<string, CompositionRow>();
  for (const item of items) {
    const kind = item.stock_item_id ? "stock" : "preparation";
    const entityId = (item.stock_item_id ?? item.preparation_id)!;
    const key = `${kind}:${entityId}`;
    let row = map.get(key);
    if (!row) {
      row = { key, kind, entityId, ref: kind === "stock" ? { stock_item_id: entityId } : { preparation_id: entityId }, bySize: {} };
      map.set(key, row);
    }
    row.bySize[item.size] = item;
  }
  return [...map.values()].sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "preparation" ? -1 : 1));
}

export type ItemChange =
  | { op: "add"; size: Variant; quantity: number }
  | { op: "update"; itemId: string; size: Variant; quantity: number }
  | { op: "delete"; itemId: string; size: Variant };

/**
 * Alterações para gravar as quantidades de um componente: 0 ou vazio apaga, valor novo cria ou
 * atualiza. Nas doces com XS, a XS segue sempre a Pequena (metade), mesmo que não venha no pedido.
 */
export function planRowChanges(
  row: Pick<CompositionRow, "bySize">,
  quantities: Partial<Record<Variant, number>>,
  options: { xsFollowsSmall: boolean },
): ItemChange[] {
  const target = { ...quantities };
  if (options.xsFollowsSmall) target.xs = target.small && target.small > 0 ? xsQuantity(target.small) : 0;
  const changes: ItemChange[] = [];
  for (const size of VARIANTS) {
    if (!(size in target)) continue;
    const q = target[size] ?? 0;
    const existing = row.bySize[size];
    if (existing && q <= 0) changes.push({ op: "delete", itemId: existing.id, size });
    else if (existing && q !== existing.quantity) changes.push({ op: "update", itemId: existing.id, size, quantity: q });
    else if (!existing && q > 0) changes.push({ op: "add", size, quantity: q });
  }
  return changes;
}
