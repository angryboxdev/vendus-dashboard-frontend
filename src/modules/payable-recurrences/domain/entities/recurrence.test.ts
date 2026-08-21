import { describe, expect, it } from "vitest";
import { expectedDocumentLabel, nextDueDate, formatPeriod } from "./recurrence.ts";

// ── expectedDocumentLabel ─────────────────────────────────────────────────────

describe("expectedDocumentLabel", () => {
  it("retorna 'Fatura' quando requireInvoice=true independentemente do tipo", () => {
    expect(expectedDocumentLabel({ requireInvoice: true, type: "fixed_contract" })).toBe("Fatura");
    expect(expectedDocumentLabel({ requireInvoice: true, type: "variable_invoice" })).toBe("Fatura");
    expect(expectedDocumentLabel({ requireInvoice: true, type: "payroll" })).toBe("Fatura");
  });

  it("retorna 'Contrato' para fixed_contract sem requireInvoice", () => {
    expect(expectedDocumentLabel({ requireInvoice: false, type: "fixed_contract" })).toBe("Contrato");
  });

  it("retorna 'Folha salarial' para payroll sem requireInvoice", () => {
    expect(expectedDocumentLabel({ requireInvoice: false, type: "payroll" })).toBe("Folha salarial");
  });

  it("retorna 'Comprovativo' para bank_auto sem requireInvoice", () => {
    expect(expectedDocumentLabel({ requireInvoice: false, type: "bank_auto" })).toBe("Comprovativo");
  });

  it("retorna 'Doc. fiscal' para fiscal sem requireInvoice", () => {
    expect(expectedDocumentLabel({ requireInvoice: false, type: "fiscal" })).toBe("Doc. fiscal");
  });

  it("retorna 'Nenhum' para tipos variáveis sem requireInvoice", () => {
    expect(expectedDocumentLabel({ requireInvoice: false, type: "variable_invoice" })).toBe("Nenhum");
    expect(expectedDocumentLabel({ requireInvoice: false, type: "recurring_service" })).toBe("Nenhum");
  });
});

// ── nextDueDate ───────────────────────────────────────────────────────────────

describe("nextDueDate", () => {
  it("retorna um objecto Date", () => {
    expect(nextDueDate(15)).toBeInstanceOf(Date);
  });

  it("o dia do mês do resultado é sempre o dayOfMonth pedido", () => {
    for (const day of [1, 5, 10, 15, 20, 28]) {
      expect(nextDueDate(day).getDate()).toBe(day);
    }
  });

  it("o resultado é no mês corrente ou no mês seguinte", () => {
    const now = new Date();
    const thisMonth = now.getMonth();
    const nextMonth = (thisMonth + 1) % 12;
    const result = nextDueDate(15);
    const resultMonth = result.getMonth();
    expect([thisMonth, nextMonth]).toContain(resultMonth);
  });

  it("para dayOfMonth claramente passado no mês, retorna mês seguinte", () => {
    // Dia 1 — já passou se hoje > 1 (praticamente sempre a partir do dia 2)
    const now = new Date();
    if (now.getDate() > 1) {
      const result = nextDueDate(1);
      const expectedMonth = (now.getMonth() + 1) % 12;
      expect(result.getMonth()).toBe(expectedMonth);
    }
  });
});

// ── formatPeriod ──────────────────────────────────────────────────────────────

describe("formatPeriod", () => {
  it("formata janeiro correctamente", () => {
    expect(formatPeriod("2026-01")).toMatch(/janeiro/i);
    expect(formatPeriod("2026-01")).toContain("2026");
  });

  it("formata março correctamente", () => {
    expect(formatPeriod("2026-03")).toMatch(/março/i);
    expect(formatPeriod("2026-03")).toContain("2026");
  });

  it("formata julho correctamente", () => {
    expect(formatPeriod("2026-07")).toMatch(/julho/i);
    expect(formatPeriod("2026-07")).toContain("2026");
  });

  it("formata dezembro correctamente", () => {
    expect(formatPeriod("2026-12")).toMatch(/dezembro/i);
    expect(formatPeriod("2026-12")).toContain("2026");
  });

  it("respeita o ano no output", () => {
    expect(formatPeriod("2025-06")).toContain("2025");
    expect(formatPeriod("2027-06")).toContain("2027");
  });
});
