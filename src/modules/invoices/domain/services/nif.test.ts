import { describe, expect, it } from "vitest";
import { checkNif, isValidPtNif, sameNif } from "./nif.ts";

describe("NIF português", () => {
  it("dígito de controlo: 502030712 válido; 502037012 (dígitos trocados) inválido", () => {
    expect(isValidPtNif("502030712")).toBe(true);
    expect(isValidPtNif("502037012")).toBe(false);
  });

  it("checkNif aceita «PT», espaços e pontos; outros formatos não são julgados", () => {
    expect(checkNif("PT 502 030 712")).toEqual({ kind: "valid" });
    expect(checkNif("502.037.012")).toEqual({ kind: "invalid" });
    expect(checkNif("  ")).toEqual({ kind: "empty" });
    expect(checkNif("ESB12345678")).toEqual({ kind: "other" });
  });

  it("sameNif ignora formatação e prefixo", () => {
    expect(sameNif("PT502030712", "502 030 712")).toBe(true);
    expect(sameNif("502037012", "502030712")).toBe(false);
    expect(sameNif("", "")).toBe(false);
  });
});
