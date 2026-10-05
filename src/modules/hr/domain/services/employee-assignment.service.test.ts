import { describe, expect, it } from "vitest";
import type { Position } from "../entities/position.ts";
import { assignableOptions, locationNameOf, normalizeAuthorizedLocations, positionNameOf } from "./employee-assignment.service.ts";

function position(id: string, name: string, active = true): Position {
  return { id, name, description: null, active, employeeCount: 0, updatedAt: "" };
}

describe("employee-assignment.service", () => {
  it("resolve nomes de cargo e local, com '—' quando não há", () => {
    const positions = [position("p1", "Gerente de Loja")];
    expect(positionNameOf(positions, "p1")).toBe("Gerente de Loja");
    expect(positionNameOf(positions, null)).toBe("—");
    expect(locationNameOf([{ id: "l1", name: "Mercado", isActive: true }], "l1")).toBe("Mercado");
  });

  it("opções de atribuição: só ativos, mais o atual mesmo que inativo (assinalado)", () => {
    const positions = [position("p1", "Gerente"), position("p2", "Copeiro", false), position("p3", "Antigo", false)];

    expect(assignableOptions(positions, (p) => p.active, ["p2"])).toEqual([
      { id: "p1", label: "Gerente" },
      { id: "p2", label: "Copeiro (inativo)" },
    ]);
  });

  it("outros locais nunca incluem o principal nem repetidos", () => {
    expect(normalizeAuthorizedLocations(["l2", "l1", "l2"], "l1")).toEqual(["l2"]);
  });
});
