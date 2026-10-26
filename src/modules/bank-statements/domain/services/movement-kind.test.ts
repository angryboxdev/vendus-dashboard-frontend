import { describe, expect, it } from "vitest";
import { matchesMovementFilter } from "./movement-kind.ts";

describe("matchesMovementFilter", () => {
  const tpa = { movementType: "credit" as const, movementKind: "sales" as const };
  const trf = { movementType: "debit" as const, movementKind: "transfer_out" as const };
  const card = { movementType: "debit" as const, movementKind: "card_purchase" as const };
  const unknown = { movementType: "credit" as const, movementKind: "to_review" as const };

  it("entradas / saídas pelo débito-crédito", () => {
    expect([tpa, trf, card, unknown].filter((m) => matchesMovementFilter(m, "inflows"))).toEqual([tpa, unknown]);
    expect([tpa, trf, card, unknown].filter((m) => matchesMovementFilter(m, "outflows"))).toEqual([trf, card]);
  });

  it("transferências e por rever pelo tipo", () => {
    expect([tpa, trf, card, unknown].filter((m) => matchesMovementFilter(m, "transfers"))).toEqual([trf]);
    expect([tpa, trf, card, unknown].filter((m) => matchesMovementFilter(m, "to_review"))).toEqual([unknown]);
  });

  it("movimento de um backend anterior (sem tipo) não entra em transferências nem em por rever", () => {
    expect(matchesMovementFilter({ movementType: "debit" }, "transfers")).toBe(false);
  });
});
