import { describe, expect, it } from "vitest";
import { emptyLine, estimateLineGross, toIssueInput, validateIssueForm, type IssueForm } from "./issue-form.service.ts";

const form = (over: Partial<IssueForm> = {}): IssueForm => ({
  seriesRef: "11111111-1111-4111-8111-111111111111",
  documentType: "FS",
  customerTaxId: "",
  customerName: "",
  paymentMechanism: "",
  lines: [{ ...emptyLine(), productCode: "PZ01", description: "Pizza", quantity: "2", unitPrice: "12,50" }],
  ...over,
});

describe("formulário de emissão", () => {
  it("estima o valor da linha com IVA incluído (só para o ecrã)", () => {
    expect(estimateLineGross({ ...emptyLine(), quantity: "2", unitPrice: "12,50", discountPct: "10" })).toBe("22.50");
    expect(estimateLineGross({ ...emptyLine(), quantity: "x", unitPrice: "1" })).toBeNull();
  });

  it("converte para o pedido da API: vírgula decimal → ponto, sem cliente = consumidor final", () => {
    expect(toIssueInput(form())).toEqual({
      seriesRef: "11111111-1111-4111-8111-111111111111",
      customer: null,
      lines: [{ productCode: "PZ01", productType: "P", unit: "UN", description: "Pizza", quantity: "2", unitPrice: "12.50", tax: { region: "PT", rate: "INT" } }],
    });
  });

  it("isenção e cliente com NIF", () => {
    const input = toIssueInput(
      form({
        customerTaxId: " 123 456 789 ",
        customerName: "Cliente Lda",
        lines: [{ ...emptyLine(), productCode: "DP", description: "Depósito", quantity: "1", unitPrice: "0.10", tax: "M99" }],
      }),
    );
    expect(input.customer).toEqual({ taxId: "123456789", name: "Cliente Lda", country: "PT" });
    expect(input.lines[0]!.tax).toEqual({ region: "PT", exemptionCode: "M99" });
  });

  it("valida antes de enviar: série, linhas completas, números, meio de pagamento na FR, nome com NIF", () => {
    expect(validateIssueForm(form())).toEqual([]);
    expect(validateIssueForm(form({ seriesRef: "" }))).toContain("Escolha a série");
    expect(validateIssueForm(form({ lines: [] }))).toContain("Acrescente pelo menos uma linha");
    expect(validateIssueForm(form({ lines: [{ ...emptyLine(), description: "", quantity: "1", unitPrice: "1" }] }))).toContain("Linha 1: falta o código ou a descrição");
    expect(validateIssueForm(form({ lines: [{ ...emptyLine(), productCode: "A", description: "B", quantity: "0", unitPrice: "1" }] }))).toContain("Linha 1: quantidade inválida");
    expect(validateIssueForm(form({ documentType: "FR" }))).toContain("Escolha o meio de pagamento");
    expect(validateIssueForm(form({ customerTaxId: "123456789" }))).toContain("Indique o nome do cliente");
  });
});
