import { describe, expect, it } from "vitest";
import { isStrongCandidate } from "./suggestions.ts";

describe("isStrongCandidate", () => {
  it("needs name, amount and ≥ 90%", () => {
    expect(isStrongCandidate({ confidence: 0.95, nameMatched: true, amountMatched: true })).toBe(true);
    expect(isStrongCandidate({ confidence: 0.89, nameMatched: true, amountMatched: true })).toBe(false);
    expect(isStrongCandidate({ confidence: 0.95, nameMatched: false, amountMatched: true })).toBe(false);
    expect(isStrongCandidate({ confidence: 0.95, nameMatched: true, amountMatched: false })).toBe(false);
  });

  it("older API without the flags never counts as a suggestion", () => {
    expect(isStrongCandidate({ confidence: 1 })).toBe(false);
  });
});
