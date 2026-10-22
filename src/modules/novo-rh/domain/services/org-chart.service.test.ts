import { describe, expect, it } from "vitest";
import { descendants, managersTree, pathsTo, teamSize, unitsTree, type OrgPerson } from "./org-chart.service.ts";

// Dados fictícios (RGPD).
const p = (id: string, name: string, location: string | null = "Loja Porto"): OrgPerson => ({ id, name, position: null, location, photoUrl: null });
const PEOPLE = [p("ceo", "Carla"), p("a", "Ana"), p("b", "Bia", "Loja Braga"), p("c", "Cid", null), p("solo", "Zé")];

describe("Organograma — árvores", () => {
  it("por chefia: raízes sem chefia, filhos por nome, equipa total e descendentes", () => {
    const tree = managersTree("Empresa Demo", PEOPLE, [
      { employeeId: "b", managerEmployeeId: "ceo" },
      { employeeId: "a", managerEmployeeId: "ceo" },
      { employeeId: "c", managerEmployeeId: "a" },
      { employeeId: "x", managerEmployeeId: "ceo" }, // fora do âmbito: ignorado
    ]);
    expect(tree.children.map((n) => n.label)).toEqual(["Carla", "Zé"]);
    expect(tree.children[0]!.children.map((n) => n.label)).toEqual(["Ana", "Bia"]);
    expect(teamSize(tree.children[0]!)).toBe(3);
    expect([...descendants(tree, "ceo")].sort()).toEqual(["a", "b", "c"]);
  });

  it("ciclos antigos não entram em loop e ninguém se perde", () => {
    const tree = managersTree("Empresa Demo", [p("a", "Ana"), p("b", "Bia")], [
      { employeeId: "a", managerEmployeeId: "b" },
      { employeeId: "b", managerEmployeeId: "a" },
    ]);
    expect(teamSize(tree)).toBe(2);
  });

  it("por centro: unidades por nome, «Sem centro» no fim; pesquisa abre o caminho", () => {
    const tree = unitsTree("Empresa Demo", PEOPLE, (x) => (x.location ? [x.location] : []), "Sem centro");
    expect(tree.children.map((n) => [n.label, n.sub])).toEqual([
      ["Loja Braga", "1 colaborador"],
      ["Loja Porto", "3 colaboradores"],
      ["Sem centro", "1 colaborador"],
    ]);
    const { hits, open } = pathsTo(tree, (n) => n.label === "Cid");
    expect([...hits]).toEqual(["c"]);
    expect([...open]).toEqual(["company", "unit:Sem centro"]);
  });
});
