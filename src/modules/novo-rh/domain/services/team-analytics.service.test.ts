import { describe, expect, it } from "vitest";
import {
  activeOn,
  ageAt,
  ageBuckets,
  averageAge,
  byUnit,
  generations,
  genderSplit,
  headcountSeries,
  inScope,
  movements,
  nationalities,
  quarterTrend,
  tenureBuckets,
  type AnalyticsPerson,
} from "./team-analytics.service.ts";

// Dados fictícios (RGPD).
const p = (id: string, over: Partial<AnalyticsPerson> = {}): AnalyticsPerson => ({
  id, hireDate: "2024-01-15", deactivatedAt: null, status: "active", birthDate: "1990-06-10", gender: "Feminino", nationality: "Portugal", primaryLocationId: "l1", ...over,
});
const PEOPLE = [
  p("a"),
  p("b", { birthDate: "1965-02-01", gender: "Masculino", nationality: "Brasil", hireDate: "2026-09-01" }),
  p("c", { birthDate: null, gender: null, nationality: null, primaryLocationId: "l2" }),
  p("d", { status: "inactive", deactivatedAt: "2026-08-10T10:00:00Z", hireDate: "2015-03-01" }),
];
const ASOF = "2026-10-22";

describe("Análise da equipa — regras", () => {
  it("ativo num dia, efetivo por mês e tendência do trimestre", () => {
    expect(activeOn(PEOPLE[3]!, "2026-08-09")).toBe(true);
    expect(activeOn(PEOPLE[3]!, "2026-08-10")).toBe(false);
    const s = headcountSeries(PEOPLE, ASOF);
    expect(s).toHaveLength(12);
    expect(s.at(-1)).toMatchObject({ key: "2026-10", date: ASOF, value: 3 });
    expect(s.find((m) => m.key === "2026-07")!.value).toBe(3);
    expect(quarterTrend(s)).toBe(0);
  });

  it("idade, idade média (só quem tem data), faixas e gerações; escondido = Desconhecido", () => {
    expect(ageAt("1990-10-23", ASOF)).toBe(35);
    expect(ageAt("1990-10-22", ASOF)).toBe(36);
    // Datas mal formadas ou idades impossíveis contam como Desconhecido.
    expect(averageAge([p("x", { birthDate: "19104-01-15" }), p("y", { birthDate: "2030-01-01" })], ASOF)).toBeNull();
    const active = PEOPLE.filter((x) => activeOn(x, ASOF));
    expect(averageAge(PEOPLE, ASOF)).toBe(49);
    expect(ageBuckets(active, ASOF).map((s) => [s.key, s.value])).toEqual([["36–45 anos", 1], ["Mais de 55 anos", 1], ["Desconhecido", 1]]);
    expect(generations(active, ASOF).map((s) => s.key)).toEqual(["Geração X (1965–1980)", "Millennials (1981–1996)", "Desconhecido"]);
    expect(genderSplit(active).map((s) => [s.key, s.value])).toEqual([["Feminino", 1], ["Masculino", 1], ["Desconhecido", 1]]);
    expect(nationalities(active, 1).map((s) => s.key)).toEqual(["Portugal", "Outras", "Desconhecido"]);
    expect(tenureBuckets(active, ASOF).map((s) => [s.key, s.value])).toEqual([["Menos de 1 ano", 1], ["2–5 anos", 2]]);
  });

  it("por unidade (com vigência), âmbito e movimentos", () => {
    const active = PEOPLE.filter((x) => activeOn(x, ASOF));
    const asg = [{ employeeId: "a", unitType: "group" as const, unitId: "g1", validFrom: "2026-01-01", validTo: null }, { employeeId: "b", unitType: "group" as const, unitId: "g1", validFrom: "2026-01-01", validTo: "2026-05-01" }];
    expect(byUnit(active, asg, "group", new Map([["g1", "Cozinha"]]), ASOF).map((s) => [s.key, s.value])).toEqual([["Sem grupo", 2], ["Cozinha", 1]]);
    expect(byUnit(active, [], "location", new Map([["l1", "Loja Porto"]]), ASOF).map((s) => s.key)).toEqual(["Loja Porto", "Desconhecido"]);
    expect(inScope(PEOPLE[0]!, { kind: "group", id: "g1" }, asg, ASOF)).toBe(true);
    expect(inScope(PEOPLE[1]!, { kind: "group", id: "g1" }, asg, ASOF)).toBe(false);
    expect(movements(PEOPLE, ASOF)).toEqual({ hires: 1, exits: 1, turnover: 34 });
  });
});
