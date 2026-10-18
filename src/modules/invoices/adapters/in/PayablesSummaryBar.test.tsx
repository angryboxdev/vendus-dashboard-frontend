import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { InvoicesProvider } from "../../invoices.module.tsx";
import type { InvoicesApiPort } from "../../domain/ports/out/invoices-api.port.ts";
import type { PayablesSummaryDTO } from "../../domain/entities/invoice.ts";
import { PayablesSummaryBar } from "./PayablesSummaryBar.tsx";
import { summaryNotes } from "../../domain/services/payables-summary.ts";

const summary = (over: Partial<PayablesSummaryDTO> = {}): PayablesSummaryDTO => ({
  currency: "EUR", today: "2026-10-18", totalOpenCents: 123456, overdueCents: 12000, documents: 7,
  missingDueDate: { count: 0, cents: 0 }, multiLocationDocuments: 0, suspectedDuplicates: 0,
  unappliedCreditCents: 0, otherCurrencies: [], ...over,
});

function renderBar(getPayablesSummary: InvoicesApiPort["getPayablesSummary"]) {
  const api = { getPayablesSummary } as unknown as InvoicesApiPort;
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <InvoicesProvider module={{ api }}>
        <PayablesSummaryBar params={{ from: "2026-10-01", to: "2026-10-31" }} />
      </InvoicesProvider>
    </QueryClientProvider>,
  );
}

describe("PayablesSummaryBar («Total a pagar | Em atraso»)", () => {
  it("mostra os dois valores, sem cards, com os filtros da lista", async () => {
    const get = vi.fn().mockResolvedValue(summary());
    renderBar(get);
    const bar = await screen.findByTestId("payables-summary");
    expect(bar.textContent).toMatch(/Total a pagar.*1234,56/);
    expect(bar.textContent).toMatch(/Em atraso.*120,00/);
    expect(get).toHaveBeenCalledWith({ from: "2026-10-01", to: "2026-10-31" });
  });

  it("erro do servidor não parte a lista", async () => {
    renderBar(vi.fn().mockRejectedValue(new Error("x")));
    expect(await screen.findByText("Total a pagar indisponível")).toBeTruthy();
  });

  it("notas: sem vencimento, crédito por aplicar, outras moedas", () => {
    expect(summaryNotes(summary({ missingDueDate: { count: 2, cents: 5000 }, unappliedCreditCents: 1000, otherCurrencies: ["USD"] })))
      .toEqual([expect.stringMatching(/2 sem vencimento/), expect.stringMatching(/Notas de crédito/), expect.stringMatching(/USD/)]);
    expect(summaryNotes(summary())).toEqual([]);
  });
});
