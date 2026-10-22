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
export interface OrgNode {
  id: string;
  kind: "company" | "unit" | "person";
  label: string;
  sub: string | null;
  person: OrgPerson | null;
  children: OrgNode[];
}

const byName = (a: OrgNode, b: OrgNode) => a.label.localeCompare(b.label, "pt");
const personNode = (p: OrgPerson, children: OrgNode[] = []): OrgNode => ({ id: p.id, kind: "person", label: p.name, sub: p.position, person: p, children });

/** Por chefia: quem não tem chefia (visível) fica logo abaixo da empresa. Ciclos antigos não entram em loop. */
export function managersTree(company: string, people: OrgPerson[], links: { employeeId: string; managerEmployeeId: string }[]): OrgNode {
  const ids = new Set(people.map((p) => p.id));
  const parent = new Map<string, string>();
  for (const l of links) if (ids.has(l.employeeId) && ids.has(l.managerEmployeeId) && l.employeeId !== l.managerEmployeeId) parent.set(l.employeeId, l.managerEmployeeId);
  const kids = new Map<string, OrgPerson[]>();
  for (const p of people) {
    const m = parent.get(p.id);
    if (m) kids.set(m, [...(kids.get(m) ?? []), p]);
  }
  const placed = new Set<string>();
  const build = (p: OrgPerson): OrgNode => {
    placed.add(p.id);
    return personNode(p, (kids.get(p.id) ?? []).filter((k) => !placed.has(k.id)).map(build).sort(byName));
  };
  const roots = people.filter((p) => !parent.has(p.id)).map(build);
  // Restos de um ciclo (sem raiz): entram também abaixo da empresa.
  for (const p of people) if (!placed.has(p.id)) roots.push(build(p));
  return { id: "company", kind: "company", label: company, sub: null, person: null, children: roots.sort(byName) };
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
  return n.children.reduce((s, c) => s + (c.kind === "person" ? 1 : 0) + teamSize(c), 0);
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
  const find = (n: OrgNode): OrgNode | null => (n.id === id ? n : n.children.map(find).find(Boolean) ?? null);
  const start = find(root);
  const walk = (n: OrgNode) => n.children.forEach((c) => (out.add(c.id), walk(c)));
  if (start) walk(start);
  return out;
}
