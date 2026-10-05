import { describe, expect, it } from "vitest";
import type { DocumentCategoryDefinition } from "../entities/document-category.ts";
import { isCategoryApplicable, matchesValidityFilter } from "./document-applicability.service.ts";

function category(overrides: Partial<DocumentCategoryDefinition>): DocumentCategoryDefinition {
  return {
    id: "c",
    slug: "c",
    label: "C",
    mandatory: true,
    jobRoles: [],
    positionIds: [],
    acceptedMimeTypes: [],
    scope: "employee",
    active: true,
    createdAt: "",
    updatedAt: "",
    ...overrides,
  };
}

describe("isCategoryApplicable (ticket 09)", () => {
  const gerente = { positionId: "pos-gerente", jobRole: "manager" as const };
  const prep = { positionId: "pos-prep", jobRole: "prep" as const };

  it("todos os colaboradores quando não há cargos selecionados", () => {
    expect(isCategoryApplicable(category({}), prep)).toBe(true);
  });

  it("cargos selecionados só aplicam a esses cargos", () => {
    const c = category({ positionIds: ["pos-gerente"] });
    expect(isCategoryApplicable(c, gerente)).toBe(true);
    expect(isCategoryApplicable(c, prep)).toBe(false);
  });

  it("nunca aplica categorias só da Empresa nem inativas", () => {
    expect(isCategoryApplicable(category({ scope: "company" }), prep)).toBe(false);
    expect(isCategoryApplicable(category({ active: false }), prep)).toBe(false);
    expect(isCategoryApplicable(category({ scope: "both" }), prep)).toBe(true);
  });
});

describe("matchesValidityFilter", () => {
  const today = "2026-10-06";
  it("com/sem validade", () => {
    expect(matchesValidityFilter(null, "without", today)).toBe(true);
    expect(matchesValidityFilter("2027-01-01", "with", today)).toBe(true);
    expect(matchesValidityFilter(null, "with", today)).toBe(false);
  });

  it("ultrapassada e janelas de 30/90 dias", () => {
    expect(matchesValidityFilter("2026-10-05", "expired", today)).toBe(true);
    expect(matchesValidityFilter("2026-11-01", "next30", today)).toBe(true);
    expect(matchesValidityFilter("2026-12-01", "next30", today)).toBe(false);
    expect(matchesValidityFilter("2026-12-01", "next90", today)).toBe(true);
    expect(matchesValidityFilter("2026-10-05", "next30", today)).toBe(false);
  });
});
