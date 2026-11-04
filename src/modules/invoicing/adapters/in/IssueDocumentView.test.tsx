import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { InvoicingUseCases } from "../../application/use-cases/invoicing.use-cases.ts";
import type { InvoicingMeta, Series } from "../../domain/entities/invoicing.ts";
import { FiscalRuleError, IssueNeedsConfirmationError } from "../../domain/errors.ts";
import type { InvoicingApiPort } from "../../domain/ports/out/invoicing-api.port.ts";
import { InvoicingProvider } from "../../invoicing.module.tsx";
import { IssueDocumentView } from "./IssueDocumentView.tsx";

const SERIES: Series = {
  ref: "11111111-1111-4111-8111-111111111111",
  legalEntityId: "22222222-2222-4222-8222-222222222222",
  locationId: null,
  documentType: "FS",
  seriesId: "L01-2027",
  mode: "training",
  validationCode: "CDF7T5HD",
  lastSequence: 0,
  lastDocumentDate: null,
  status: "active",
};

const META: InvoicingMeta = {
  certified: false,
  certificateNumber: "0",
  signingAvailable: true,
  simplifiedInvoiceLimitNet: "100",
  documentTypes: ["FT", "FS", "FR", "NC", "ND", "CM"],
  vatRates: [],
  exemptions: [{ code: "M99", mention: "Não sujeito ou não tributado" }],
  cancelReasons: [],
};

function renderView(issue: InvoicingApiPort["issue"]) {
  let n = 0;
  const api = {
    meta: vi.fn(async () => META),
    listSeries: vi.fn(async () => [SERIES]),
    issue: vi.fn(issue),
  } as unknown as InvoicingApiPort;
  render(
    <MemoryRouter>
      <InvoicingProvider module={{ invoicing: new InvoicingUseCases(api, { next: () => `chave-${++n}` }, { save: () => {} }) }}>
        <IssueDocumentView />
      </InvoicingProvider>
    </MemoryRouter>,
  );
  return api;
}

async function fillForm(user: ReturnType<typeof userEvent.setup>) {
  await user.selectOptions(await screen.findByLabelText("Série"), SERIES.ref);
  await user.type(screen.getByLabelText("Código da linha 1"), "PZ01");
  await user.type(screen.getByLabelText("Descrição da linha 1"), "Pizza");
  await user.type(screen.getByLabelText("Preço da linha 1"), "12,50");
}

describe("IssueDocumentView", () => {
  it("emite a fatura simplificada e mostra o número e o ATCUD", async () => {
    const user = userEvent.setup();
    const api = renderView(async () => ({ documentId: "d1", documentNumber: "FS L01-2027/1", atcud: "CDF7T5HD-1" }));

    await fillForm(user);
    expect(screen.getByText("12.50 €")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Emitir documento" }));

    expect(await screen.findByText("Documento FS L01-2027/1 emitido")).toBeInTheDocument();
    expect(vi.mocked(api.issue).mock.calls[0]![0]).toMatchObject({
      seriesRef: SERIES.ref,
      customer: null,
      lines: [{ productCode: "PZ01", description: "Pizza", quantity: "1", unitPrice: "12.50", tax: { region: "PT", rate: "INT" } }],
    });
  });

  it("avisos do servidor pedem confirmação; confirmar reenvia com chave nova", async () => {
    const user = userEvent.setup();
    const api = renderView(
      vi
        .fn()
        .mockRejectedValueOnce(new IssueNeedsConfirmationError(["future-document-date"]))
        .mockResolvedValueOnce({ documentId: "d1", documentNumber: "FS L01-2027/1", atcud: "CDF7T5HD-1" }),
    );

    await fillForm(user);
    await user.click(screen.getByRole("button", { name: "Emitir documento" }));
    expect(await screen.findByText("A data do documento é futura.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Emitir mesmo assim" }));

    await screen.findByText("Documento FS L01-2027/1 emitido");
    const calls = vi.mocked(api.issue).mock.calls;
    expect(calls[1]![0]).toMatchObject({ confirmWarnings: true });
    expect(calls[1]![1]).not.toBe(calls[0]![1]);
  });

  it("regra fiscal recusada pelo servidor aparece no formulário", async () => {
    const user = userEvent.setup();
    renderView(async () => {
      throw new FiscalRuleError("Fatura simplificada só até 100 € sem IVA — emitir fatura ou fatura-recibo");
    });

    await fillForm(user);
    await user.click(screen.getByRole("button", { name: "Emitir documento" }));
    await waitFor(() => expect(screen.getByText(/Fatura simplificada só até 100 €/)).toBeInTheDocument());
  });
});
