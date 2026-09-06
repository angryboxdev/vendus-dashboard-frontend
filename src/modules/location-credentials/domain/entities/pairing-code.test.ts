import { describe, expect, it } from "vitest";
import { PairingCode } from "./pairing-code.ts";

describe("PairingCode", () => {
  it("computes remaining seconds before expiry", () => {
    const now = new Date("2026-01-01T10:00:00Z");
    const code = PairingCode.create({
      code: "ABCD1234",
      expiresAt: new Date("2026-01-01T10:10:00Z"),
    });
    expect(code.remainingSeconds(now)).toBe(600);
  });

  it("is not expired while time remains", () => {
    const now = new Date("2026-01-01T10:00:00Z");
    const code = PairingCode.create({
      code: "ABCD1234",
      expiresAt: new Date("2026-01-01T10:10:00Z"),
    });
    expect(code.isExpired(now)).toBe(false);
  });

  it("is expired exactly at expiresAt", () => {
    const expiresAt = new Date("2026-01-01T10:10:00Z");
    const code = PairingCode.create({ code: "ABCD1234", expiresAt });
    expect(code.remainingSeconds(expiresAt)).toBe(0);
    expect(code.isExpired(expiresAt)).toBe(true);
  });

  it("is expired after expiresAt, remainingSeconds floors at 0", () => {
    const expiresAt = new Date("2026-01-01T10:10:00Z");
    const code = PairingCode.create({ code: "ABCD1234", expiresAt });
    const now = new Date("2026-01-01T10:20:00Z");
    expect(code.remainingSeconds(now)).toBe(0);
    expect(code.isExpired(now)).toBe(true);
  });

  it("floors partial seconds", () => {
    const now = new Date("2026-01-01T10:00:00.400Z");
    const code = PairingCode.create({
      code: "ABCD1234",
      expiresAt: new Date("2026-01-01T10:00:05.900Z"),
    });
    expect(code.remainingSeconds(now)).toBe(5);
  });
});
