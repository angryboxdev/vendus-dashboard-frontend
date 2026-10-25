import { describe, expect, it } from "vitest";
import { supplierInitials } from "./supplier-initials.ts";

describe("supplierInitials", () => {
  it.each([
    ["Makro Portugal", "MP"],
    ["makro", "MA"],
    ["  Frutas & Legumes Silva ", "FL"],
    ["Água Serra", "ÁS"],
    ["", "?"],
  ])("%s → %s", (name, expected) => {
    expect(supplierInitials(name)).toBe(expected);
  });
});
