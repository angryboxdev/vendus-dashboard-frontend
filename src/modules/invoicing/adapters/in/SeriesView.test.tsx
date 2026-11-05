import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { InvoicingUseCases } from "../../application/use-cases/invoicing.use-cases.ts";
import type { InvoicingApiPort, IssuerSyncResult } from "../../domain/ports/out/invoicing-api.port.ts";
import { InvoicingProvider } from "../../invoicing.module.tsx";
import { SeriesView } from "./SeriesView.tsx";

const LE = { id: "22222222-2222-4222-8222-222222222222", name: "Empresa Fictícia, Lda", taxId: "599999999" };

function renderView(over: Partial<InvoicingApiPort> = {}) {
  const api = {
    meta: vi.fn(async () => ({ certified: false })),
    listSeries: vi.fn(async () => []),
    legalEntities: vi.fn(async () => []),
    syncIssuerFromCompany: vi.fn(async (): Promise<IssuerSyncResult> => ({ status: "synced" })),
    ...over,
  } as unknown as InvoicingApiPort;
  render(
    <MemoryRouter>
      <InvoicingProvider module={{ invoicing: new InvoicingUseCases(api, { next: () => "k" }, { save: () => {} }) }}>
        <SeriesView />
      </InvoicingProvider>
    </MemoryRouter>,
  );
  return api;
}

describe("SeriesView — emitente", () => {
  it("sem emitente: «Usar os dados da Empresa» diz o que falta", async () => {
    const user = userEvent.setup();
    const api = renderView({ syncIssuerFromCompany: vi.fn(async (): Promise<IssuerSyncResult> => ({ status: "incomplete", missing: ["niss", "region"] })) });
    await user.click(await screen.findByRole("button", { name: "Usar os dados da Empresa" }));
    expect(api.syncIssuerFromCompany).toHaveBeenCalled();
    expect(await screen.findByRole("alert")).toHaveTextContent("Falta preencher na Empresa: NISS, Distrito / região.");
  });

  it("sincronizado: recarrega e o emitente aparece na lista", async () => {
    const user = userEvent.setup();
    const legalEntities = vi.fn().mockResolvedValueOnce([]).mockResolvedValue([LE]);
    renderView({ legalEntities });
    await user.click(await screen.findByRole("button", { name: "Usar os dados da Empresa" }));
    expect(await screen.findByRole("option", { name: "Empresa Fictícia, Lda (599999999)" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Usar os dados da Empresa" })).not.toBeInTheDocument();
  });

  it("erro a carregar os emitentes aparece em vez de uma lista vazia", async () => {
    renderView({ legalEntities: vi.fn(async () => Promise.reject(new Error("Sem permissão"))) });
    expect(await screen.findByText(/Não foi possível carregar os emitentes: Sem permissão/)).toBeInTheDocument();
  });
});
