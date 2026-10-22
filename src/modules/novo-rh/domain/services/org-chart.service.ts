/**
 * Mais → Organograma: árvores prontas a partir do que já existe — chefias
 * diretas (modelo «Por chefia»), centro principal ou departamento. Só monta a
 * árvore; mudar a chefia é a API do servidor (que recusa ciclos).
 */

export type OrgModel = "managers" | "location" | "department";

export interface OrgPerson {
  id: string;
  name: string;
  position: string | null;
  location: string | null;
  photoUrl: string | null;
}
/** `group` = co-chefia: duas ou mais pessoas que partilham a mesma equipa (ex.: os sócios). */
export interface OrgNode {
  id: string;
  kind: "company" | "unit" | "person" | "group";
  label: string;
  sub: string | null;
  person: OrgPerson | null;
  /** Pessoas do cartão conjunto (só em `group`). */
  members?: OrgPerson[];
  children: OrgNode[];
}

const byName = (a: OrgNode, b: OrgNode) => a.label.localeCompare(b.label, "pt");
const personNode = (p: OrgPerson, children: OrgNode[] = []): OrgNode => ({ id: p.id, kind: "person", label: p.name, sub: p.position, person: p, children });

/** Responsáveis diretos visíveis de cada pessoa (ordenados, sem repetidos). */
export function managersOf(people: OrgPerson[], links: { employeeId: string; managerEmployeeId: string }[]): Map<string, string[]> {
  const ids = new Set(people.map((p) => p.id));
  const out = new Map<string, string[]>();
  for (const l of links) {
    if (!ids.has(l.employeeId) || !ids.has(l.managerEmployeeId) || l.employeeId === l.managerEmployeeId) continue;
    const list = out.get(l.employeeId) ?? [];
    if (!list.includes(l.managerEmployeeId)) list.push(l.managerEmployeeId);
    out.set(l.employeeId, list.sort());
  }
  return out;
}

/**
 * Por chefia: quem não tem chefia (visível) fica logo abaixo da empresa. Quem
 * tem dois ou mais responsáveis diretos (co-chefia) fica por baixo de um cartão
 * conjunto com essas pessoas — e a equipa que cada uma chefia sozinha também.
 * Ciclos antigos não entram em loop e ninguém se perde.
 */
export function managersTree(company: string, people: OrgPerson[], links: { employeeId: string; managerEmployeeId: string }[]): OrgNode {
  const byId = new Map(people.map((p) => [p.id, p]));
  const mgrs = managersOf(people, links);
  // Co-chefias; quem está em várias fica na maior (as outras caem para o primeiro responsável).
  const groups = new Map<string, string[]>();
  for (const ms of mgrs.values()) if (ms.length > 1) groups.set(ms.join("+"), ms);
  const groupOf = new Map<string, string>();
  for (const [key, ms] of [...groups].sort((x, y) => y[1].length - x[1].length)) {
    if (ms.some((m) => groupOf.has(m))) {
      groups.delete(key);
      continue;
    }
    for (const m of ms) groupOf.set(m, key);
  }
  const nodeOfPerson = (id: string) => (groupOf.has(id) ? `g:${groupOf.get(id)}` : id);
  const parentOf = (id: string): string | null => {
    const ms = mgrs.get(id) ?? [];
    if (!ms.length) return null;
    const key = ms.join("+");
    return ms.length > 1 && groups.has(key) ? `g:${key}` : nodeOfPerson(ms[0]!);
  };
  // Nós: pessoas fora de co-chefias + um por co-chefia; o pai de um cartão conjunto é o do 1.º membro.
  const nodes = new Map<string, OrgNode>();
  for (const p of people) if (!groupOf.has(p.id)) nodes.set(p.id, personNode(p));
  for (const [key, ms] of groups) {
    const members = ms.map((m) => byId.get(m)!).sort((x, y) => x.name.localeCompare(y.name, "pt"));
    nodes.set(`g:${key}`, { id: `g:${key}`, kind: "group", label: members.map((m) => m.name).join(" + "), sub: "Chefia partilhada", person: null, members, children: [] });
  }
  const parentOfNode = (nodeId: string) => (nodeId.startsWith("g:") ? parentOf(groups.get(nodeId.slice(2))![0]!) : parentOf(nodeId));
  const kids = new Map<string, string[]>();
  for (const id of nodes.keys()) {
    const parent = parentOfNode(id);
    if (parent && parent !== id && nodes.has(parent)) kids.set(parent, [...(kids.get(parent) ?? []), id]);
  }
  const placed = new Set<string>();
  const build = (id: string): OrgNode => {
    placed.add(id);
    const n = nodes.get(id)!;
    return { ...n, children: (kids.get(id) ?? []).filter((k) => !placed.has(k)).map(build).sort(byName) };
  };
  const roots = [...nodes.keys()].filter((id) => {
    const parent = parentOfNode(id);
    return !parent || parent === id || !nodes.has(parent);
  });
  const children = roots.map(build);
  for (const id of nodes.keys()) if (!placed.has(id)) children.push(build(id));
  return { id: "company", kind: "company", label: company, sub: null, person: null, children: children.sort(byName) };
}

/** Por centro ou departamento: empresa → unidades → pessoas (sem unidade num grupo próprio). */
export function unitsTree(company: string, people: OrgPerson[], unitOf: (p: OrgPerson) => string[], empty: string): OrgNode {
  const groups = new Map<string, OrgPerson[]>();
  for (const p of people) {
    const units = unitOf(p);
    for (const u of units.length ? units : [empty]) groups.set(u, [...(groups.get(u) ?? []), p]);
  }
  const units = [...groups].map(([u, list]): OrgNode => ({ id: `unit:${u}`, kind: "unit", label: u, sub: `${list.length} ${list.length === 1 ? "colaborador" : "colaboradores"}`, person: null, children: list.map((p) => personNode(p)).sort(byName) }));
  return { id: "company", kind: "company", label: company, sub: null, person: null, children: units.sort((a, b) => (a.label === empty ? 1 : b.label === empty ? -1 : byName(a, b))) };
}

/** Pessoas abaixo de um nó (equipa total, para o selo do botão recolher). */
export function teamSize(n: OrgNode): number {
  return n.children.reduce((s, c) => s + (c.kind === "person" ? 1 : c.kind === "group" ? (c.members?.length ?? 0) : 0) + teamSize(c), 0);
}

/** Ids dos nós a abrir para mostrar quem corresponde à pesquisa (o caminho até lá). */
export function pathsTo(root: OrgNode, match: (n: OrgNode) => boolean): { hits: Set<string>; open: Set<string> } {
  const hits = new Set<string>();
  const open = new Set<string>();
  const walk = (n: OrgNode, trail: string[]) => {
    if (match(n)) {
      hits.add(n.id);
      for (const t of trail) open.add(t);
    }
    for (const c of n.children) walk(c, [...trail, n.id]);
  };
  walk(root, []);
  return { hits, open };
}

/** Descendentes de uma pessoa (no modelo por chefia): não pode passar a chefiar quem a chefia. */
export function descendants(root: OrgNode, id: string): Set<string> {
  const out = new Set<string>();
  const find = (n: OrgNode): OrgNode | null => (n.id === id || n.members?.some((m) => m.id === id) ? n : n.children.map(find).find(Boolean) ?? null);
  const start = find(root);
  const walk = (n: OrgNode) => n.children.forEach((c) => (out.add(c.id), c.members?.forEach((m) => out.add(m.id)), walk(c)));
  if (start) walk(start);
  return out;
}
