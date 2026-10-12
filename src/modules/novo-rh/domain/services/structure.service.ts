import type { Group } from "../entities/governance.ts";

/** Grupos em árvore (ordem de leitura: pai, depois os filhos), com a profundidade de cada um. */
export function groupTree(groups: Group[]): { group: Group; depth: number }[] {
  const ids = new Set(groups.map((g) => g.id));
  const children = new Map<string | null, Group[]>();
  for (const g of groups) {
    // Pai arquivado/inexistente → aparece na raiz em vez de desaparecer.
    const parent = g.parentId && ids.has(g.parentId) ? g.parentId : null;
    children.set(parent, [...(children.get(parent) ?? []), g]);
  }
  for (const list of children.values()) list.sort((a, b) => a.name.localeCompare(b.name, "pt"));
  const out: { group: Group; depth: number }[] = [];
  const seen = new Set<string>();
  const walk = (parent: string | null, depth: number) => {
    for (const g of children.get(parent) ?? []) {
      if (seen.has(g.id)) continue;
      seen.add(g.id);
      out.push({ group: g, depth });
      walk(g.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}
