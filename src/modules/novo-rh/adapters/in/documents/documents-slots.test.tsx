import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { fakeNovoRhModule } from "../../../fake-module.test-utils.ts";
import { NovoRhProvider, type NovoRhModule } from "../../../novo-rh.module.tsx";
import { DocumentsTab } from "../people/PersonTabs.tsx";
import { NovoRhSlotsContext, type NovoRhSlots } from "../slots.ts";
import { DocumentsView } from "./DocumentsView.tsx";

function renderWith(m: NovoRhModule, slots: NovoRhSlots, ui: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <NovoRhProvider module={m}>
        <NovoRhSlotsContext.Provider value={slots}>
          <MemoryRouter>{ui}</MemoryRouter>
        </NovoRhSlotsContext.Provider>
      </NovoRhProvider>
    </QueryClientProvider>,
  );
}

describe("Documentos — motores existentes encaixados (FE-022/FE-065)", () => {
  it("ficha: mostra os documentos do motor e os envios recebidos com o estado", async () => {
    const m = fakeNovoRhModule();
    m.distributions.forEmployee = vi.fn(async () => [{ id: "d1", title: "Normas de segurança", fileName: "n.pdf", mimeType: "application/pdf", sizeBytes: 1, audience: { type: "all" as const }, requiresConfirmation: true, status: "sent" as const, createdBy: "rh", createdAt: "2026-10-12T09:00:00Z", readAt: "2026-10-12T10:00:00Z", confirmedAt: null }]);
    renderWith(m, { personDocuments: (id) => <p>motor de documentos de {id}</p> }, <DocumentsTab personId="e1" />);
    expect(screen.getByText("motor de documentos de e1")).toBeInTheDocument();
    expect(await screen.findByText("Normas de segurança")).toBeInTheDocument();
    expect(screen.getByText(/Aberto/)).toBeInTheDocument();
    expect(m.distributions.forEmployee).toHaveBeenCalledWith("e1");
  });

  it("ficha sem slot (ex.: testes): ligação para a página antiga", () => {
    renderWith(fakeNovoRhModule(), {}, <DocumentsTab personId="e1" />);
    expect(screen.getByRole("link", { name: /→/ })).toHaveAttribute("href", "/hr/people/e1");
  });

  it("separador Documentos: empresa (slot) e envio a colaboradores", async () => {
    renderWith(fakeNovoRhModule(), { companyDocuments: () => <p>documentos da empresa</p> }, <DocumentsView />);
    expect(screen.getByText("documentos da empresa")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: "Enviar a colaboradores" }));
    expect(screen.getByRole("region", { name: "Enviar documento a colaboradores" })).toBeInTheDocument();
  });
});
