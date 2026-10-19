import { describe, expect, it } from "vitest";
import type { RosterShift, ShiftTemplate } from "../entities/rosters.ts";
import { buildScheduleExport, segmentsText, type ExportGroupBy } from "./schedule-export.service.ts";

/** Dados fictícios: semana de 19 a 25/10/2026, centro com Sala/Caixa, dois cargos. */
const DAYS = ["2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23", "2026-10-24", "2026-10-25"];
const T = (id: string, name: string, abbreviation: string, segs: [string, string][]): ShiftTemplate => ({ id, name, abbreviation, color: null, onCall: false, segments: segs.map(([start, end]) => ({ start, end })), archived: false });
const TPL = [T("m", "Manhã", "M", [["08:00", "16:00"]]), T("n", "Noite", "N", [["18:00", "00:45"]]), T("fcl", "Fecho", "FCL", [["16:00", "23:30"]])];
let n = 0;
const S = (employeeId: string, day: number, templateId: string | null, areaId: string | null = null, extra: Partial<RosterShift> = {}): RosterShift => {
  const st = { employeeId, workDate: DAYS[day]!, kind: "shift" as const, segments: templateId ? [] : [{ start: "10:00", end: "14:00" }], templateId, onCall: false, areaId };
  return { ...st, id: `s${++n}`, rosterId: "r1", deleted: false, dirty: false, published: st, publishedVersion: 1, ...extra };
};
const OFF = (employeeId: string, day: number): RosterShift => ({ ...S(employeeId, day, null), kind: "day_off", segments: [], templateId: null });
const PEOPLE = [
  { employeeId: "e1", name: "Ana Teste", positionId: "p1" },
  { employeeId: "e2", name: "Bruno Teste", positionId: "p2" },
  { employeeId: "e3", name: "Ana Teste", positionId: null }, // nome igual, outra pessoa
];
const AREAS = [
  { id: "a1", name: "Sala", sortOrder: 0 },
  { id: "a2", name: "Caixa", sortOrder: 1 },
];
const POSITIONS = [
  { id: "p1", name: "Empregado de mesa" },
  { id: "p2", name: "Cozinheiro" },
];
const SHIFTS = [
  S("e1", 0, "m", "a1"),
  S("e1", 1, "m", "a2"), // mesma pessoa, outra área
  S("e1", 2, "n", "a1"), // passa a meia-noite
  OFF("e1", 3),
  S("e2", 0, "fcl"),
  S("e2", 0, null, "a2"), // dois turnos no mesmo dia (um sem modelo)
  S("e3", 4, "m", "a1", { dirty: true }), // por publicar
  { ...S("e2", 5, "m"), deleted: true }, // retirado: nunca entra
];
const build = (groupBy: ExportGroupBy, filters = {}) => buildScheduleExport({ days: DAYS, people: PEOPLE, shifts: SHIFTS, templates: TPL, areas: AREAS, positions: POSITIONS, groupBy, filters });
const count = (x: ReturnType<typeof build>) => x.groups.reduce((t, g) => t + g.rows.reduce((u, r) => u + r.days.reduce((v, d) => v + d.length, 0), 0), 0);

describe("Exportação da escala — dados", () => {
  it("quatro organizações do mesmo conjunto: cada atribuição uma só vez, nada inventado", () => {
    for (const g of ["employee", "shift", "area", "position"] as const) {
      const x = build(g);
      expect(x.assignments).toBe(7);
      expect(count(x)).toBe(7);
    }
  });

  it("por área: Sala, Caixa, Sem área e Folga; a mesma pessoa aparece nas áreas onde trabalhou", () => {
    const x = build("area");
    expect(x.groups.map((g) => g.title)).toEqual(["Sala", "Caixa", "Sem área", "Folga"]);
    expect(x.groups[0]!.rows.map((r) => r.employeeId)).toEqual(["e1", "e3"]);
    expect(x.groups[1]!.rows.map((r) => r.employeeId)).toEqual(["e1", "e2"]);
  });

  it("por turno: secções por modelo (sigla e horário), sem modelo e folga no fim", () => {
    const x = build("shift");
    expect(x.groups.map((g) => g.title)).toEqual(["Manhã (M) · 08:00–16:00", "Fecho (FCL) · 16:00–23:30", "Noite (N) · 18:00–00:45 (+1 dia)", "Horários sem modelo", "Folga"]);
  });

  it("por cargo e por colaborador: ordem da vista; nomes iguais são pessoas diferentes", () => {
    expect(build("position").groups.map((g) => g.title)).toEqual(["Cozinheiro", "Empregado de mesa", "Sem cargo"]);
    const all = build("employee");
    expect(all.groups).toHaveLength(1);
    expect(all.groups[0]!.title).toBeNull();
    expect(all.groups[0]!.rows.map((r) => r.employeeId)).toEqual(["e1", "e2", "e3"]);
  });

  it("células: folga ≠ sem turno; meia-noite com (+1 dia); dois turnos no mesmo dia; área; rascunho", () => {
    const row = build("employee").groups[0]!.rows;
    const e1 = row.find((r) => r.employeeId === "e1")!;
    expect(e1.days[2]![0]).toMatchObject({ code: "N", time: "18:00–00:45 (+1 dia)", nextDay: true, area: "Sala" });
    expect(e1.days[3]![0]).toMatchObject({ kind: "day_off", code: "F", time: "" });
    expect(e1.days[4]).toEqual([]);
    expect(row.find((r) => r.employeeId === "e2")!.days[0]!.map((c) => c.code)).toEqual(["P1", "FCL"]);
    expect(row.find((r) => r.employeeId === "e3")!.days[4]![0]!.draft).toBe(true);
    expect(build("employee").hasDraft).toBe(true);
    expect(segmentsText([{ start: "09:00", end: "13:00" }, { start: "19:00", end: "01:00" }])).toBe("09:00–13:00 · 19:00–01:00 (+1 dia)");
  });

  it("filtros combinados (centro já é a escala): colaborador, área, turno e cargo; sem correspondência → vazio", () => {
    expect(count(build("employee", { areaIds: ["a1"] }))).toBe(3);
    expect(count(build("employee", { templateIds: ["m"], positionIds: ["p1"] }))).toBe(2);
    expect(count(build("employee", { templateIds: ["day_off"] }))).toBe(1);
    expect(count(build("employee", { areaIds: ["none"] }))).toBe(1);
    const none = build("employee", { employeeIds: ["e2"], areaIds: ["a1"] });
    expect(none.groups).toEqual([]);
    expect(none.assignments).toBe(0);
  });

  it("um só colaborador escolhido → versão individual; legenda só com as siglas usadas", () => {
    const one = build("area", { employeeIds: ["e1"] });
    expect(one.individual).toBe(true);
    expect(one.legend.map((l) => l.code)).toEqual(["M", "N", "F"]);
    expect(build("employee", { employeeIds: ["e1", "e2"] }).individual).toBe(false);
  });

  it("nunca leva horas, totais nem dados pessoais", () => {
    const text = JSON.stringify(build("employee"));
    expect(text).not.toMatch(/minutes|total|hours|horas|nif|iban|photo/i);
  });
});
