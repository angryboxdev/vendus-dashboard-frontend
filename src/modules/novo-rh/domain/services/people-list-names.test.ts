import { describe, expect, it } from "vitest";
import { displayDate, shortName } from "./people-list.service.ts";

describe("lista premium — nome curto e datas", () => {
  it("primeiro e último nome, sem partir apelidos compostos", () => {
    expect(shortName("Carla Demo")).toBe("Carla Demo");
    expect(shortName("Ana")).toBe("Ana");
    expect(shortName("  Rui   Pedro  Teste ")).toBe("Rui Teste");
    expect(shortName("Maria Joana da Silva")).toBe("Maria da Silva");
    expect(shortName("Ana Sofia Costa e Silva")).toBe("Ana Costa e Silva");
    expect(shortName("João dos Santos")).toBe("João dos Santos");
  });
  it("datas em DD/MM/AAAA e «—» sem data", () => {
    expect(displayDate("2026-10-01")).toBe("01/10/2026");
    expect(displayDate(null)).toBe("—");
    expect(displayDate("")).toBe("—");
  });
});
