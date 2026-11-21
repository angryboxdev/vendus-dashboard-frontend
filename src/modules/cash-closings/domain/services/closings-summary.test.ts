import { describe, expect, it } from "vitest";
import type { CashClosing } from "../entities/cash-closing.ts";
import { airMenuDiff, groupClosingsByDay, vendusDiff, worstStatus } from "./closings-summary.ts";

function closing(p: Partial<CashClosing>): CashClosing {
  const tpa = p.tpa ?? 0;
  const eatz = p.eatz ?? 0;
  const cashSales = p.cashSales ?? 0;
  const uber = p.uber ?? 0;
  const glovo = p.glovo ?? 0;
  const bolt = p.bolt ?? 0;
  return {
    id: "c1",
    closingDate: "2026-11-06",
    employeeId: "e1",
    employeeName: "Ana",
    tpa,
    uber,
    glovo,
    bolt,
    eatz,
    cashSales,
    cashIn: 0,
    cashOut: 0,
    cashDrawerOpen: 100,
    cashDrawerTotal: 100,
    totalCalculated: tpa + eatz + cashSales + uber + glovo + bolt,
    vendusTotal: null,
    sangriaAmount: 0,
    notes: null,
    status: "pending",
    managerNotes: null,
    reviewedAt: null,
    submittedAt: "2026-11-06T10:47:00Z",
    airMenuUber: null,
    airMenuGlovo: null,
    airMenuBolt: null,
    vendusCalculated: tpa + eatz + cashSales,
    airMenuCalculated: uber + glovo + bolt,
    airMenuTotal: null,
    ...p,
  };
}

describe("vendusDiff", () => {
  it("compara só o canal próprio com o Vendus (as apps de entregas não entram)", () => {
    // Caso real de 01/10: total declarado 808,45 € com 317,48 € de apps; Vendus 490,87 €.
    const c = closing({ tpa: 384.2, cashSales: 84.5, eatz: 22.27, uber: 234.42, glovo: 44.87, bolt: 38.19, vendusTotal: 490.87 });
    expect(vendusDiff(c)).toBe(0.1);
  });

  it("é null sem referência Vendus", () => {
    expect(vendusDiff(closing({ tpa: 10 }))).toBeNull();
  });
});

describe("airMenuDiff", () => {
  it("compara as apps declaradas com o AirMenu", () => {
    expect(airMenuDiff(closing({ uber: 100, glovo: 50, airMenuTotal: 140 }))).toBe(10);
  });

  it("é null sem referência AirMenu", () => {
    expect(airMenuDiff(closing({ uber: 100 }))).toBeNull();
  });
});

describe("worstStatus", () => {
  it("pendente prevalece sobre rejeitado e aprovado", () => {
    expect(worstStatus([closing({ status: "approved" }), closing({ status: "pending" })])).toBe("pending");
    expect(worstStatus([closing({ status: "approved" }), closing({ status: "rejected" })])).toBe("rejected");
    expect(worstStatus([closing({ status: "approved" })])).toBe("approved");
    expect(worstStatus([])).toBeNull();
  });
});

describe("groupClosingsByDay", () => {
  // Caso real de 06/11: dois fechos (manhã e noite); o AirMenu devolve o total do dia nos dois.
  const morning = closing({
    id: "m",
    tpa: 494.3,
    cashSales: 19.9,
    eatz: 27.38,
    uber: 324.03,
    glovo: 37.75,
    vendusTotal: 541.58,
    airMenuTotal: 361.78,
    sangriaAmount: 46.4,
    submittedAt: "2026-11-06T10:47:00Z",
    employeeName: "Ana",
  });
  const night = closing({
    id: "n",
    tpa: 82.9,
    cashSales: 26.3,
    vendusTotal: 109.2,
    airMenuTotal: 361.78,
    status: "approved",
    submittedAt: "2026-11-06T21:13:00Z",
    employeeName: "Rui",
  });

  it("junta os fechos do mesmo dia numa só linha, somando os valores", () => {
    const [day] = groupClosingsByDay([night, morning]);
    expect(day!.closings.map((c) => c.id)).toEqual(["m", "n"]);
    expect(day!.employeeNames).toEqual(["Ana", "Rui"]);
    expect(day!.totalCalculated).toBe(1012.56);
    expect(day!.vendusTotal).toBe(650.78);
    expect(day!.vendusDiff).toBe(0);
    expect(day!.sangriaAmount).toBe(46.4);
    expect(day!.status).toBe("pending");
    expect(day!.lastSubmittedAt).toBe("2026-11-06T21:13:00Z");
  });

  it("conta o total AirMenu do dia uma só vez (não soma o de cada fecho)", () => {
    const [day] = groupClosingsByDay([morning, night]);
    expect(day!.airMenuTotal).toBe(361.78);
    expect(day!.airMenuDiff).toBe(0);
  });

  it("a referência Vendus do dia fica null se faltar a de algum fecho", () => {
    const [day] = groupClosingsByDay([morning, { ...night, vendusTotal: null }]);
    expect(day!.vendusTotal).toBeNull();
    expect(day!.vendusDiff).toBeNull();
  });

  it("um dia por data, do mais recente para o mais antigo", () => {
    const other = closing({ id: "o", closingDate: "2026-11-05", submittedAt: "2026-11-05T10:00:00Z" });
    const days = groupClosingsByDay([other, morning, night]);
    expect(days.map((d) => [d.date, d.closings.length])).toEqual([
      ["2026-11-06", 2],
      ["2026-11-05", 1],
    ]);
  });
});
