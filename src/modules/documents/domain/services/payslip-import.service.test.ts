import { describe, expect, it } from "vitest";
import type { PayslipPreviewRow } from "../entities/payslip-import.ts";
import { buildPayslipMapping, defaultPayslipPeriod, formatPeriod, initialPayslipDecision } from "./payslip-import.service.ts";

function row(overrides: Partial<PayslipPreviewRow>): PayslipPreviewRow {
  return {
    fileName: "a.pdf",
    period: "2026-09",
    status: "identified",
    employeeId: "e1",
    employeeName: "Carlos Andrés",
    matchReason: "name",
    reviewReason: null,
    candidates: [],
    existingDocumentId: null,
    hasText: true,
    ...overrides,
  };
}

describe("payslip-import.service (ticket 10)", () => {
  it("formata o período e propõe o mês anterior", () => {
    expect(formatPeriod("2026-09")).toBe("09/2026");
    expect(formatPeriod(null)).toBe("—");
    expect(defaultPayslipPeriod("2026-10-05")).toBe("2026-09");
    expect(defaultPayslipPeriod("2027-01-10")).toBe("2026-12");
  });

  it("só o identificado é importado sem intervenção; duplicado e Rever ficam de fora", () => {
    expect(initialPayslipDecision(row({}))).toEqual({ employeeId: "e1", action: "create" });
    expect(initialPayslipDecision(row({ status: "duplicate", existingDocumentId: "d1" }))).toEqual({ employeeId: "e1", action: "skip" });
    expect(initialPayslipDecision(row({ status: "review", employeeId: null, employeeName: null }))).toEqual({ employeeId: null, action: "skip" });
  });

  it("monta o mapeamento e recusa dois recibos para o mesmo colaborador", () => {
    const rows = [row({ fileName: "a.pdf" }), row({ fileName: "b.pdf", status: "review", employeeId: null }), row({ fileName: "c.pdf", status: "duplicate" })];
    const ok = buildPayslipMapping(
      rows,
      { "a.pdf": { employeeId: "e1", action: "create" }, "b.pdf": { employeeId: "e2", action: "create" }, "c.pdf": { employeeId: "e3", action: "replace" } },
      () => "X",
    );
    expect(ok).toEqual({
      mapping: [
        { fileName: "a.pdf", employeeId: "e1", action: "create" },
        { fileName: "b.pdf", employeeId: "e2", action: "create" },
        { fileName: "c.pdf", employeeId: "e3", action: "replace" },
      ],
      errors: [],
    });

    const clash = buildPayslipMapping(rows, { "a.pdf": { employeeId: "e1", action: "create" }, "b.pdf": { employeeId: "e1", action: "create" } }, () => "Carlos Andrés");
    expect(clash.errors).toEqual(["Carlos Andrés tem mais de um recibo neste período — escolha só um."]);
  });
});
