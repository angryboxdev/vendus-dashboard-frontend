import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PaymentDocumentImportDTO } from "../../domain/entities/payment-document.ts";
import { isPaymentDocument } from "../../domain/entities/payment-document.ts";
import { PaymentDocumentReview } from "./PaymentDocumentReview.tsx";

const at = (over: Partial<PaymentDocumentImportDTO> = {}): PaymentDocumentImportDTO => ({
  kind: "payment_document",
  payment: {
    kind: "at_withholding", obligationType: "obrigacao_fiscal", subtype: "retencoes_irs_prediais", issuer: "AT",
    taxpayerNif: "999999990", documentNumber: "12345678901", period: "2026-10",
    lines: [{ code: "104", description: "104 - IRS - Prediais", amountCents: 25000, interestCents: 0, totalCents: 25000 }],
    paymentReference: "123456789012345", mbEntity: null, amountCents: 25000, interestCents: 0, totalCents: 25000,
    dueDate: "2026-11-20", issueDate: null, declarationReceivedAt: "2026-11-05 10:00:00", vat: "not_applicable",
    barcode: { status: "decoded", symbology: "CODE128", payload: "1".repeat(41), page: 1 }, barcodePrintedText: "1".repeat(41),
    fieldSources: { paymentReference: "text" }, issues: [{ code: "due_date_passed", blocking: false, detail: "O prazo terminou a 2026-11-20." }], status: "ready",
  },
  matches: [{ existing: { source: "invoice", id: "inv-1", invoiceId: "inv-1", label: "12345687901", supplierName: "DGTF", amountCents: 25000, dueDate: "2026-11-20", documentDate: null, status: "paid" }, reasons: ["similar_number", "same_amount_and_due_date"], strength: "strong" }],
  supplierSuggestion: { id: "s1", name: "DGTF", defaultCostCenterGroupId: null, defaultCostCenterCategoryId: null },
  metrics: { totalMs: 900, barcodeMs: 200, aiCalls: 0 },
  ...over,
});

describe("PaymentDocumentReview", () => {
  it("mostra a obrigação (sem IVA), a referência separada do código de barras e o registo já existente", () => {
    const onOpen = vi.fn();
    render(<PaymentDocumentReview result={at()} busy={false} onOpenExisting={onOpen} onLaunchAsInvoice={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText("Finanças — Retenções na fonte (IRS prediais)")).toBeTruthy();
    expect(screen.getByText("Não aplicável")).toBeTruthy();
    expect(screen.getByText("123 456 789 012 345")).toBeTruthy();
    expect(screen.getByText(/CODE128 lido \(41 dígitos\)/)).toBeTruthy();
    expect(screen.getByText("Esta obrigação parece já estar registada.")).toBeTruthy();
    expect(screen.getByText("O prazo terminou a 2026-11-20.")).toBeTruthy();
    fireEvent.click(screen.getByText("Abrir"));
    expect(onOpen).toHaveBeenCalledWith("inv-1");
  });

  it("com registo parecido, «Lançar pelo fluxo atual» pede confirmação", () => {
    const onLaunch = vi.fn();
    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
    render(<PaymentDocumentReview result={at()} busy={false} onOpenExisting={vi.fn()} onLaunchAsInvoice={onLaunch} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText("Lançar pelo fluxo atual"));
    expect(onLaunch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Lançar pelo fluxo atual"));
    expect(onLaunch).toHaveBeenCalledTimes(1);
    confirm.mockRestore();
  });

  it("Segurança Social sem código de barras e sem registo parecido", () => {
    const base = at();
    const ss = at({
      matches: [],
      payment: { ...base.payment, kind: "ss_payment_reference", obligationType: "obrigacao_contributiva", subtype: "seguranca_social_entidade_empregadora", issuer: "SS", documentNumber: null, mbEntity: "12345", paymentReference: "098765432", barcode: { status: "absent" }, barcodePrintedText: null, issues: [] },
    });
    render(<PaymentDocumentReview result={ss} busy={false} onOpenExisting={vi.fn()} onLaunchAsInvoice={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText("Segurança Social — Contribuições da entidade empregadora")).toBeTruthy();
    expect(screen.getByText("098 765 432")).toBeTruthy();
    expect(screen.getByText("Sem código de barras (não é necessário)")).toBeTruthy();
    expect(screen.getByText("Nenhuma obrigação parecida encontrada.")).toBeTruthy();
  });

  it("reconhece a resposta de documento de cobrança", () => {
    expect(isPaymentDocument(at())).toBe(true);
    expect(isPaymentDocument({ invoice: {} })).toBe(false);
  });
});
