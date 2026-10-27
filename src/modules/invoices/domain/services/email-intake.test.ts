import { describe, expect, it } from "vitest";
import { emailIntakeStatus, isPendingReview } from "./email-intake.ts";

describe("Faturas por email — estado de cada PDF", () => {
  it("etiquetas da task e cor", () => {
    expect(emailIntakeStatus({ status: "imported", retrying: false })).toEqual({ label: "Por rever", tone: "success" });
    expect(emailIntakeStatus({ status: "duplicate", retrying: false }).label).toBe("Duplicado");
    expect(emailIntakeStatus({ status: "rejected", retrying: false }).tone).toBe("danger");
    expect(emailIntakeStatus({ status: "read_error", retrying: true }).label).toBe("Erro — vai tentar de novo");
    expect(emailIntakeStatus({ status: "read_error", retrying: false }).label).toBe("Erro de leitura");
  });
});

describe("Separador «Por rever»", () => {
  it("rascunhos lidos e faturas marcadas para rever (não pagas nem anuladas)", () => {
    expect(isPendingReview({ status: "draft_ai", requiresReview: false })).toBe(true);
    expect(isPendingReview({ status: "pending_review", requiresReview: false })).toBe(true);
    expect(isPendingReview({ status: "pending", requiresReview: true })).toBe(true);
    expect(isPendingReview({ status: "pending", requiresReview: false })).toBe(false);
    expect(isPendingReview({ status: "paid", requiresReview: true })).toBe(false);
  });
});
