import { describe, expect, it } from "vitest";
import type { CompactBucket, SalesAnalysisData } from "../entities/sales-analysis.ts";
import { buildAnalysis, hourRows, isOutsideHours, currentBuckets } from "./analysis.service.ts";
import { presetRange, rangeProblem, shiftMonth } from "./periods.ts";

const CH = ["salao", "take_away", "eatz", "apps"] as SalesAnalysisData["channels"];

function data(current: CompactBucket[], over: Partial<SalesAnalysisData> = {}): SalesAnalysisData {
  return {
    today: "2026-11-07",
    source: "vendus",
    range: { from: "2026-11-02", to: "2026-11-07" }, // seg → sáb
    prevYearRange: { from: "2025-11-02", to: "2025-11-07" },
    prevMonthRange: { from: "2026-10-02", to: "2026-10-07" },
    channels: CH,
    current,
    prevYear: [],
    prevMonth: [],
    vendus: { missingDays: 0, fill: null, todayLive: true },
    airMenu: null,
    ...over,
  };
}

describe("buildAnalysis", () => {
  const cur: CompactBucket[] = [
    ["2026-11-02", 13, 0, 10_000, 8_850, 4],
    ["2026-11-02", 20, 0, 20_000, 17_700, 6],
    ["2026-11-06", 20, 0, 50_000, 44_250, 15], // sexta forte
    ["2026-11-06", 20, 3, 5_000, 4_425, 2],
    ["2026-11-07", 23, 0, 3_000, 2_655, 1], // sábado 23h: dentro do horário
    ["2026-11-03", 23, 0, 1_000, 885, 1], // terça 23h: fora do horário
    ["2026-11-04", 9, 1, 500, 442, 1], // 9h: fora do horário (alarga as horas mostradas)
  ];
  const a = buildAnalysis(data(cur, {
    prevYear: [["2025-11-06", -1, 0, 40_000, 35_400, 12]],
    prevMonth: [["2026-10-06", -1, 0, 30_000, 26_550, 9]],
  }));

  it("totais, ticket médio e média diária", () => {
    expect(a.totals.grossCents).toBe(89_500);
    expect(a.totals.count).toBe(30);
    expect(a.totals.avgTicketCents).toBeCloseTo(89_500 / 30);
    expect(a.totals.avgDailyCents).toBeCloseTo(89_500 / 6);
    expect(a.prevYear.grossCents).toBe(40_000);
  });

  it("dia mais forte e mais fraco (dias a zero contam)", () => {
    expect(a.strongest.date).toBe("2026-11-06");
    expect(a.strongest.count).toBe(17);
    expect(a.weakest.date).toBe("2026-11-05");
    expect(a.zeroDays).toEqual(["2026-11-05"]);
  });

  it("liga o mesmo dia do ano anterior e do mês anterior", () => {
    const fri = a.days.find((d) => d.date === "2026-11-06")!;
    expect(fri.prevYearGrossCents).toBe(40_000);
    expect(fri.prevMonthGrossCents).toBe(30_000);
    expect(fri.prevMonthCount).toBe(9);
  });

  it("hora de pico com n.º de vendas; horas fora do horário contam e ficam assinaladas", () => {
    expect(a.peakHour!.hour).toBe(20);
    expect(a.peakHour!.count).toBe(23);
    expect(a.hours[0]!.hour).toBe(9);
    expect(a.hours[0]!.outside).toBe(true);
    expect(a.outsideHoursCents).toBe(1_500); // terça 23h + 9h
    expect(a.outsideHoursCount).toBe(2);
  });

  it("horário: sexta e sábado até 23h30; restantes até 22h30", () => {
    expect(isOutsideHours(6, 23)).toBe(false);
    expect(isOutsideHours(2, 23)).toBe(true);
    expect(isOutsideHours(2, 22)).toBe(false);
    expect(isOutsideHours(1, 11)).toBe(true);
  });

  it("faixas sem vendas dentro do horário", () => {
    expect(a.silentSlots).toContainEqual({ weekday: 1, hour: 16 });
    expect(a.silentSlots).not.toContainEqual({ weekday: 1, hour: 13 });
    // Terça 23h está fora do horário → não é «sem vendas».
    expect(a.silentSlots).not.toContainEqual({ weekday: 2, hour: 23 });
  });

  it("canais: peso e hora de pico", () => {
    const salao = a.channels.find((c) => c.channel === "salao")!;
    expect(salao.peakHour).toBe(20);
    expect(salao.share).toBeCloseTo(84_000 / 89_500);
    expect(salao.prevYearGrossCents).toBe(40_000);
  });

  it("linhas por hora com vendas por canal (para o detalhe)", () => {
    const rows = hourRows(currentBuckets(data(cur)).filter((b) => b.date === "2026-11-06"), [20]);
    expect(rows[0]).toEqual({ hour: 20, grossCents: 55_000, count: 17, byChannel: { salao: 15, apps: 2 } });
  });
});

describe("períodos", () => {
  const today = "2026-11-21";
  it("atalhos", () => {
    expect(presetRange("this_month", { from: "", to: "" }, today)).toEqual({ from: "2026-11-01", to: "2026-11-21" });
    expect(presetRange("last_month", { from: "", to: "" }, "2026-03-15")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
    expect(presetRange("this_year", { from: "", to: "" }, today)).toEqual({ from: "2026-01-01", to: "2026-11-21" });
  });

  it("valida o período", () => {
    expect(rangeProblem({ from: "2026-11-10", to: "2026-11-01" }, today)).toMatch(/posterior/);
    expect(rangeProblem({ from: "2026-11-01", to: "2026-11-22" }, today)).toMatch(/depois de hoje/);
    expect(rangeProblem({ from: "2025-11-01", to: "2026-11-21" }, today)).toMatch(/12 meses/);
    expect(rangeProblem({ from: "2025-11-22", to: "2026-11-21" }, today)).toBeNull();
  });

  it("mês anterior de 31 fica no último dia", () => {
    expect(shiftMonth("2026-03-31", -1)).toBe("2026-02-28");
  });
});
