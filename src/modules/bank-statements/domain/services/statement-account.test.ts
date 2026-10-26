import { describe, expect, it } from "vitest";
import { isSameAccount, maskIban } from "./statement-account.ts";

describe("isSameAccount", () => {
  it("nº de conta do extrato dentro do IBAN registado → mesma conta", () => {
    expect(isSameAccount("PT50 0033 0000 1234 5678 9010 1", "12345678901", null)).toBe(true);
  });
  it("IBAN igual com espaços diferentes → mesma conta", () => {
    expect(isSameAccount("PT50003300001234567890101", null, "PT50 0033 0000 1234 5678 9010 1")).toBe(true);
  });
  it("outra conta → diferente", () => {
    expect(isSameAccount("PT50 0033 0000 1234 5678 9010 1", "99988877766", "PT50003300009998887776605")).toBe(false);
  });
});

describe("maskIban", () => {
  it("mostra só o início e o fim", () => {
    expect(maskIban("PT50003300001234567890101")).toBe("PT50 0033 •••• •••• •••• 9010 1");
  });
});
