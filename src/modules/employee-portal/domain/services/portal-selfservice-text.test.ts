import { describe, expect, it } from "vitest";
import type { MyDocument } from "../entities/portal.ts";
import { expiryState, mondayOf, periodLabel, splitDocuments, weekLabel } from "./portal-text.service.ts";

const doc = (over: Partial<MyDocument>): MyDocument => ({
  id: "d",
  categoryLabel: "NIF",
  fileName: "x.pdf",
  period: null,
  isPayslip: false,
  issuedAt: null,
  expiresAt: null,
  uploadedAt: "2026-01-01T00:00:00Z",
  ...over,
});

describe("Portal — regras da consulta", () => {
  it("semana de segunda a domingo", () => {
    expect(mondayOf("2026-10-07")).toBe("2026-10-05");
    expect(mondayOf("2026-10-05")).toBe("2026-10-05");
    expect(mondayOf("2026-10-11")).toBe("2026-10-05");
    expect(weekLabel("2026-10-05")).toBe("05/10 – 11/10");
  });

  it("período dos recibos", () => {
    expect(periodLabel("2026-10")).toBe("OUT 2026");
    expect(periodLabel("2026-01")).toBe("JAN 2026");
  });

  it("vencido / a vencer em 30 dias / ok", () => {
    expect(expiryState(doc({ expiresAt: "2026-10-06" }), "2026-10-07")).toBe("expired");
    expect(expiryState(doc({ expiresAt: "2026-10-07" }), "2026-10-07")).toBe("expiring");
    expect(expiryState(doc({ expiresAt: "2026-11-06" }), "2026-10-07")).toBe("expiring");
    expect(expiryState(doc({ expiresAt: "2026-11-07" }), "2026-10-07")).toBe("ok");
    expect(expiryState(doc({ expiresAt: null }), "2026-10-07")).toBe("ok");
  });

  it("separa recibos dos restantes documentos", () => {
    const r = splitDocuments([doc({ id: "a", isPayslip: true, period: "2026-09" }), doc({ id: "b" })]);
    expect(r.payslips.map((d) => d.id)).toEqual(["a"]);
    expect(r.others.map((d) => d.id)).toEqual(["b"]);
  });
});
