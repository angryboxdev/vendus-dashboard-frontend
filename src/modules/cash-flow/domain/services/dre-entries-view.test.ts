import { describe, expect, it } from "vitest";
import { groupDreEntries, shortDate } from "./dre-entries-view.ts";
import { sampleDreEntries } from "./dre-fixtures.ts";

describe("groupDreEntries", () => {
  it("só a linha pedida, agrupada pela rubrica (maior primeiro), por data de competência, com os totais", () => {
    const groups = groupDreEntries(sampleDreEntries().entries, "personnel", new Map([["c-sal", "Salários"]]));
    expect(groups.map((g) => [g.key, g.label, g.netCents, g.entries.length])).toEqual([
      ["c-sal", "Salários", 100_000, 2],
      ["c-enc", "Sem categoria", 20_000, 1],
    ]);
    expect(groups[0]!.entries.map((e) => e.movementId)).toEqual(["m2", "m1"]);
  });

  it("data curta", () => {
    expect(shortDate("2026-03-08")).toBe("08/03/2026");
  });
});
