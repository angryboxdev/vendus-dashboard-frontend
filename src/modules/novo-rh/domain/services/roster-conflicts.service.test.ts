import { describe, expect, it } from "vitest";
import type { RosterCandidates, Violation } from "../entities/rosters.ts";
import { busyLabel, conflictGroups, conflictShiftIds, conflictSummary, conflictTarget, pickerGroups, weekLabel } from "./roster-conflicts.service.ts";

// Dados fictícios (RGPD).
const people = [
  { id: "e1", name: "Ana Teste", photoUrl: null, primaryLocationId: "porto" },
  { id: "e2", name: "Bruno Teste", photoUrl: null, primaryLocationId: "braga" },
  { id: "e3", name: "Carla Teste", photoUrl: null, primaryLocationId: "braga" },
  { id: "e4", name: "Duarte Teste", photoUrl: null, primaryLocationId: "aveiro" },
  { id: "e5", name: "Eva Teste", photoUrl: null, primaryLocationId: "braga" },
];
const names: Record<string, string> = { porto: "Centro Porto", braga: "Centro Braga", aveiro: "Centro Aveiro" };
const candidates: RosterCandidates = {
  roster: { id: "r1", targetType: "location", targetId: "porto" },
  members: ["e5"], // pertença datada ao Porto, apesar do principal ser Braga
  busy: [{ employeeId: "e3", rosterId: "r2", rosterName: "Centro Braga", shiftId: "s9", workDate: "2026-10-26", hours: "09:00–13:00", published: true }],
};
const groups = (search = "", inRoster = new Set<string>()) => pickerGroups({ people, inRoster, candidates, locationName: (id) => (id ? names[id]! : null), search });

describe("Seletor de colaboradores", () => {
  it("centro da escala (principal ou pertença) → outros centros sem turnos → já escalados noutros centros", () => {
    const g = groups();
    expect(g.center.map((x) => x.id)).toEqual(["e1", "e5"]);
    expect(g.others.map((x) => [x.id, x.locationName])).toEqual([["e4", "Centro Aveiro"], ["e2", "Centro Braga"]]); // por centro, depois nome
    expect(g.scheduled.map((x) => x.id)).toEqual(["e3"]);
    expect(busyLabel(g.scheduled[0]!.busy[0]!)).toBe("Seg 26/10 09:00–13:00 · Centro Braga");
  });

  it("pesquisa em todos os grupos, por nome ou centro; quem já está na escala fica marcado", () => {
    expect(groups("carla").scheduled.map((x) => x.id)).toEqual(["e3"]);
    const byCenter = groups("aveiro");
    expect([...byCenter.center, ...byCenter.others, ...byCenter.scheduled].map((x) => x.id)).toEqual(["e4"]);
    expect(groups("", new Set(["e1"])).center[0]).toMatchObject({ id: "e1", inRoster: true });
  });
});

const v = (o: Partial<Violation>): Violation => ({ rule: "overlap", severity: "block", employeeId: "e1", workDate: "2026-10-26", message: "x", ...o });

describe("Conflitos", () => {
  it("agrupa por colaborador (mais ocorrências primeiro), resume semanas e afetados", () => {
    const list = [v({ workDate: "2026-10-27" }), v({}), v({ employeeId: "e2", severity: "warning", rule: "min_rest" }), v({ workDate: "2026-11-03" })];
    const g = conflictGroups(list, (id) => (id === "e1" ? "Ana Teste" : "Bruno Teste"));
    expect(g.map((x) => [x.name, x.items.length, x.blocking])).toEqual([["Ana Teste", 3, 3], ["Bruno Teste", 1, 0]]);
    expect(g[0]!.items.map((x) => x.workDate)).toEqual(["2026-10-26", "2026-10-27", "2026-11-03"]);
    expect(conflictSummary(list)).toEqual({ total: 4, blocking: 3, employees: 2, weeks: ["2026-10-26", "2026-11-02"] });
    expect(weekLabel("2026-10-28")).toBe("Semana de 26/10 a 01/11");
  });

  it("destaca o turno afetado e o incompatível; abrir leva à escala e semana de cada um", () => {
    const x = v({ shiftId: "a", rosterId: "r1", conflict: { shiftId: "b", rosterId: "r2", rosterName: "Centro Braga", workDate: "2026-11-02", hours: "22:00–06:00", published: false } });
    expect([...conflictShiftIds([x])]).toEqual(["a", "b"]);
    expect(conflictTarget(x, "self", "r1")).toEqual({ rosterId: "r1", weekFrom: "2026-10-26", shiftId: "a" });
    expect(conflictTarget(x, "other", "r1")).toEqual({ rosterId: "r2", weekFrom: "2026-11-02", shiftId: "b" });
  });
});
