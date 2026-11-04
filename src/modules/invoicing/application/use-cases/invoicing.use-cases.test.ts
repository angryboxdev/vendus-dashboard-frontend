import { describe, expect, it, vi } from "vitest";
import { FiscalRuleError, IssueNeedsConfirmationError } from "../../domain/errors.ts";
import type { InvoicingApiPort } from "../../domain/ports/out/invoicing-api.port.ts";
import { emptyLine, type IssueForm } from "../../domain/services/issue-form.service.ts";
import { InvoicingUseCases } from "./invoicing.use-cases.ts";

const form: IssueForm = {
  seriesRef: "11111111-1111-4111-8111-111111111111",
  documentType: "FS",
  customerTaxId: "",
  customerName: "",
  paymentMechanism: "",
  lines: [{ ...emptyLine(), productCode: "PZ01", description: "Pizza", quantity: "1", unitPrice: "12.50" }],
};

function api(over: Partial<InvoicingApiPort> = {}): InvoicingApiPort {
  return {
    meta: vi.fn(),
    listSeries: vi.fn(),
    createSeries: vi.fn(),
    setValidationCode: vi.fn(),
    listDocuments: vi.fn(),
    getDocument: vi.fn(),
    issue: vi.fn(async () => ({ documentId: "d1", documentNumber: "FS L01-2027/1", atcud: "CDF7T5HD-1" })),
    cancel: vi.fn(),
    legalEntities: vi.fn(),
    exportSaft: vi.fn(async () => new Blob(["<AuditFile/>"])),
    ...over,
  };
}

const ids = { next: () => "chave-1" };

describe("exportar SAF-T", () => {
  const q = { legalEntityId: "22222222-2222-4222-8222-222222222222", from: "2027-03-01", to: "2027-03-31", includeTraining: true };

  it("valida o período antes de chamar a API (um só ano fiscal)", async () => {
    const port = api();
    const uc = new InvoicingUseCases(port, ids, { save: vi.fn() });
    expect(await uc.exportSaft({ ...q, legalEntityId: "" })).toEqual(["Escolha o emitente"]);
    expect(await uc.exportSaft({ ...q, from: "2027-04-01" })).toEqual(["O início é depois do fim"]);
    expect(await uc.exportSaft({ ...q, from: "2026-12-01" })).toEqual(["O SAF-T cobre um só ano — divida o período"]);
    expect(port.exportSaft).not.toHaveBeenCalled();
  });

  it("descarrega o ficheiro com o nome do período", async () => {
    const save = vi.fn();
    const port = api();
    expect(await new InvoicingUseCases(port, ids, { save }).exportSaft(q)).toEqual([]);
    expect(port.exportSaft).toHaveBeenCalledWith(q);
    expect(save).toHaveBeenCalledWith("SAFT_2027-03-01_2027-03-31.xml", expect.any(Blob));
  });
});

describe("emitir pelo formulário", () => {
  it("valida antes de chamar a API", async () => {
    const port = api();
    const out = await new InvoicingUseCases(port, ids).issue({ ...form, seriesRef: "" }, { attemptKey: "k" });
    expect(out).toEqual({ kind: "invalid", errors: ["Escolha a série"] });
    expect(port.issue).not.toHaveBeenCalled();
  });

  it("emite com a chave da tentativa e pedido já convertido", async () => {
    const port = api();
    const out = await new InvoicingUseCases(port, ids).issue(form, { attemptKey: "k-1" });
    expect(out).toEqual({ kind: "issued", result: { documentId: "d1", documentNumber: "FS L01-2027/1", atcud: "CDF7T5HD-1" } });
    expect(port.issue).toHaveBeenCalledWith(expect.objectContaining({ seriesRef: form.seriesRef, customer: null }), "k-1");
  });

  it("409 com avisos → pede confirmação; confirmar reenvia com confirmWarnings", async () => {
    const issue = vi.fn().mockRejectedValueOnce(new IssueNeedsConfirmationError(["future-document-date"])).mockResolvedValueOnce({ documentId: "d1", documentNumber: "n", atcud: "a" });
    const uc = new InvoicingUseCases(api({ issue }), ids);

    expect(await uc.issue(form, { attemptKey: "k-1" })).toEqual({ kind: "needs-confirmation", warnings: ["A data do documento é futura."] });
    await uc.issue(form, { attemptKey: "k-2", confirmWarnings: true });
    expect(issue.mock.calls[1]![0]).toMatchObject({ confirmWarnings: true });
  });

  it("regra fiscal recusada pelo servidor (422) volta como erro do formulário", async () => {
    const issue = vi.fn().mockRejectedValue(new FiscalRuleError("Fatura simplificada só até 100 € sem IVA"));
    expect(await new InvoicingUseCases(api({ issue }), ids).issue(form, { attemptKey: "k" })).toEqual({
      kind: "invalid",
      errors: ["Fatura simplificada só até 100 € sem IVA"],
    });
  });
});
