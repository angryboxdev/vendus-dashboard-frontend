import { describe, expect, it } from "vitest";
import {
  homeFromNovoRh,
  leaveFromAbsences,
  localTimeIn,
  punchResultFromNovoRh,
  reasonComment,
  requestsFromAbsences,
  shiftsFromRoster,
  splitReason,
  type NovoRhAbsence,
} from "./novo-rh-portal.service.ts";

const TYPES = { dayOffTypeId: "t-folga", justifiedTypeId: "t-just" };
const profile = { employeeId: "e1", firstName: "Carla", fullName: "Carla Demo Teste", locationName: "Loja Teste" };

const absence = (o: Partial<NovoRhAbsence>): NovoRhAbsence => ({
  id: "a1",
  typeId: "t-folga",
  typeName: "Folga",
  typeCategory: "permission",
  startDate: "2026-10-20",
  endDate: "2026-10-20",
  amount: 1,
  unit: "days",
  status: "pending",
  comment: null,
  attachment: null,
  createdAt: "2026-10-18T10:00:00.000Z",
  ...o,
});

describe("Portal sobre o Novo RH — mapeamentos", () => {
  it("escala: turnos e folgas, dois períodos, noturno e o centro da ficha quando o turno não traz", () => {
    const shifts = shiftsFromRoster(
      [
        { id: "s2", workDate: "2026-10-21", kind: "shift", segments: [{ start: "22:00", end: "06:00" }] },
        { id: "s1", workDate: "2026-10-20", kind: "shift", segments: [{ start: "09:00", end: "13:00" }, { start: "14:00", end: "18:00" }] },
        { id: "s3", workDate: "2026-10-22", kind: "day_off", segments: [] },
      ],
      "Loja Teste",
    );
    expect(shifts.map((s) => s.id)).toEqual(["s1", "s2", "s3"]);
    expect(shifts[0]).toMatchObject({ startTime: "09:00", endTime: "13:00", secondStartTime: "14:00", secondEndTime: "18:00", endsNextDay: false, locationName: "Loja Teste" });
    expect(shifts[1]).toMatchObject({ endsNextDay: true, secondStartTime: null });
    expect(shifts[2]).toMatchObject({ kind: "day_off", startTime: "" });
  });

  it("escala: centro, área e modelo do turno; três períodos e o último depois da meia-noite", () => {
    const [s] = shiftsFromRoster(
      [
        {
          id: "s1",
          workDate: "2026-10-20",
          kind: "shift",
          segments: [{ start: "12:00", end: "15:00" }, { start: "19:00", end: "23:30" }, { start: "00:00", end: "01:00" }],
          locationId: "l2",
          locationName: "Loja Ribeira",
          areaName: "Bar",
          template: { name: "Fecho", abbreviation: "F", color: "#2a78d6" },
        },
      ],
      "Loja Teste",
    );
    expect(s).toMatchObject({ locationId: "l2", locationName: "Loja Ribeira", areaName: "Bar", template: { abbreviation: "F" }, endsNextDay: true });
    expect(s!.segments).toHaveLength(3);
  });

  it("início: a próxima é um turno, nunca uma folga", () => {
    const shifts = shiftsFromRoster(
      [
        { id: "f", workDate: "2026-10-20", kind: "day_off", segments: [] },
        { id: "t", workDate: "2026-10-21", kind: "shift", segments: [{ start: "09:00", end: "17:00" }] },
      ],
      null,
    );
    const home = homeFromNovoRh(profile, { employeeId: "e1", timeZone: "Europe/Lisbon", state: "off", since: null }, shifts, "2026-10-20");
    expect(home.nextShift).toMatchObject({ workDate: "2026-10-21" });
  });

  it("início: fora de trabalho → Registar entrada; a trabalhar → Registar saída desde a marcação", () => {
    const shifts = shiftsFromRoster([{ id: "s1", workDate: "2026-10-20", kind: "shift", segments: [{ start: "09:00", end: "17:00" }] }], null);
    const off = homeFromNovoRh(profile, { employeeId: "e1", timeZone: "Europe/Lisbon", state: "off", since: "2026-10-17T18:00:00.000Z" }, shifts, "2026-10-18");
    expect(off.employee.shortName).toBe("Carla");
    expect(off.nextShift).toMatchObject({ workDate: "2026-10-20", startTime: "09:00" });
    expect(off.punch).toMatchObject({ state: "not_in", since: null, action: "in", blockedReason: null });
    const working = homeFromNovoRh(profile, { employeeId: "e1", timeZone: "Europe/Lisbon", state: "work", since: "2026-10-18T08:00:00.000Z" }, [], "2026-10-18");
    expect(working.nextShift).toBeNull();
    // Hora local de Lisboa (verão: UTC+1) e a localização pede-se sempre (o servidor decide).
    expect(working.punch).toMatchObject({ state: "in", since: "09:00", action: "out", geofencePolicy: "warn" });
    const older = homeFromNovoRh(profile, { employeeId: "e1", timeZone: "Europe/Lisbon", state: "work", since: "2026-10-16T19:12:09.306Z" }, [], "2026-10-18");
    expect(older.punch.since).toBe("16/10 20:12");
  });

  it("resultado da picagem: hora local e repetição (mesmo clientEventId)", () => {
    expect(localTimeIn("2026-10-18T08:05:00.000Z", "Europe/Lisbon")).toBe("09:05");
    const r = punchResultFromNovoRh("in", { occurredAt: "2026-10-18T08:05:00.000Z" }, true, "Europe/Lisbon");
    expect(r).toMatchObject({ kind: "in", time: "09:05", replay: true, geofence: { status: "not_required" } });
  });

  it("ausências do ano: só aprovadas, por categoria; a Falta justificada conta como justificada", () => {
    const leave = leaveFromAbsences(
      [
        absence({ id: "v", typeId: "t-ferias", typeCategory: "vacation", status: "approved", startDate: "2026-08-03", endDate: "2026-08-07", amount: 5 }),
        absence({ id: "j", typeId: "t-just", typeCategory: "permission", status: "approved", startDate: "2026-09-01", endDate: "2026-09-01" }),
        absence({ id: "m", typeId: "t-x", typeCategory: null, status: "approved", startDate: "2026-03-02", endDate: "2026-03-02" }),
        absence({ id: "p", status: "pending" }),
        absence({ id: "old", typeCategory: "vacation", status: "approved", startDate: "2025-08-01", endDate: "2025-08-02" }),
      ],
      2026,
      TYPES,
    );
    expect(leave.entries.map((e) => [e.id, e.type, e.workingDays])).toEqual([
      ["m", "other", 1],
      ["v", "vacation", 5],
      ["j", "justified", 1],
    ]);
  });

  it("pedidos: só Folga e Falta justificada, motivo separado do texto, mais recentes primeiro", () => {
    const list = requestsFromAbsences(
      [
        absence({ id: "f", comment: reasonComment("Assunto pessoal", "Casamento"), createdAt: "2026-10-01T00:00:00.000Z" }),
        absence({ id: "j", typeId: "t-just", typeName: "Falta justificada", comment: null, attachment: { name: "atestado.pdf", mime: "application/pdf" }, createdAt: "2026-10-05T00:00:00.000Z" }),
        absence({ id: "x", typeId: "t-ferias" }),
      ],
      TYPES,
    );
    expect(list.map((r) => r.id)).toEqual(["j", "f"]);
    expect(list[0]).toMatchObject({ kind: "justify_absence", reasonLabel: "Falta justificada", attachmentName: "atestado.pdf" });
    expect(list[1]).toMatchObject({ kind: "day_off", reasonLabel: "Assunto pessoal", reasonText: "Casamento" });
  });

  it("comentário do motivo: ida e volta", () => {
    expect(reasonComment("Doença", null)).toBe("Doença");
    expect(splitReason(reasonComment("Doença", "  febre "))).toEqual({ label: "Doença", text: "febre" });
    expect(splitReason(null)).toEqual({ label: null, text: null });
  });
});
