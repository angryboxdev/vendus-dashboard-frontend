import { describe, expect, it } from "vitest";
import { addDays, daysFrom } from "./rosters.service.ts";

describe("addDays", () => {
  it("avança e recua semanas (navegação da escala)", () => {
    expect(addDays("2026-10-26", 7)).toBe("2026-11-02");
    expect(addDays("2026-10-26", -7)).toBe("2026-10-19");
    expect(addDays("2026-10-26", 0)).toBe("2026-10-26");
  });

  it("atravessa meses e anos", () => {
    expect(addDays("2026-01-05", -7)).toBe("2025-12-29");
    expect(addDays("2026-02-23", 6)).toBe("2026-03-01");
  });

  it("recuar e avançar repõe a data", () => {
    expect(addDays(addDays("2026-10-26", -7), 7)).toBe("2026-10-26");
  });
});

describe("daysFrom", () => {
  it("lista os dias do período", () => {
    expect(daysFrom("2026-10-26", 3)).toEqual(["2026-10-26", "2026-10-27", "2026-10-28"]);
  });
});
