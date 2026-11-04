import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { InvoicingUseCases } from "../../application/use-cases/invoicing.use-cases.ts";
import type { AtStatus } from "../../domain/entities/invoicing.ts";
import type { InvoicingApiPort } from "../../domain/ports/out/invoicing-api.port.ts";
import { InvoicingProvider } from "../../invoicing.module.tsx";
import { AtCommunicationView } from "./AtCommunicationView.tsx";

const LE = "22222222-2222-4222-8222-222222222222";
const STATUS: AtStatus = {
  configured: true,
  environment: "test",
  credentials: [],
  queue: { pending: 3, blocked: 1, oldestPendingDate: "2027-02-27", deadline: "2027-03-05", overdue: true, dueSoon: false },
  problems: [{ documentId: "d1", documentNumber: "FS L01-2027/1", code: -8, message: "Código de isenção inválido", outcome: "rejected" }],
};

function renderView(over: Partial<InvoicingApiPort> = {}) {
  const api = {
    atStatus: vi.fn(async () => STATUS),
    legalEntities: vi.fn(async () => [{ id: LE, name: "Empresa Fictícia, Lda", taxId: "599999999" }]),
    communicateAt: vi.fn(async () => ({ attempted: 2, accepted: 1, rejected: 0, failed: 1, withoutCredentials: 0 })),
    saveAtCredentials: vi.fn(async () => undefined),
    ...over,
  } as unknown as InvoicingApiPort;
  render(
    <MemoryRouter>
      <InvoicingProvider module={{ invoicing: new InvoicingUseCases(api, { next: () => "k" }, { save: () => {} }) }}>
        <AtCommunicationView />
      </InvoicingProvider>
    </MemoryRouter>,
  );
  return api;
}

describe("AtCommunicationView", () => {
  it("mostra pendentes, prazo ultrapassado e as recusas da AT", async () => {
    renderView();
    expect(await screen.findByText("Prazo de comunicação ultrapassado")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("FS L01-2027/1")).toBeInTheDocument();
    expect(screen.getByText("Código de isenção inválido")).toBeInTheDocument();
  });

  it("«Comunicar agora» envia e mostra o resumo", async () => {
    const user = userEvent.setup();
    const api = renderView();
    await user.click(await screen.findByRole("button", { name: "Comunicar agora" }));
    expect(api.communicateAt).toHaveBeenCalledWith(false);
    expect(await screen.findByText("2 enviado(s): 1 aceite(s), 0 recusado(s), 1 por repetir.")).toBeInTheDocument();
  });

  it("credenciais: formato errado não chega à API; certo grava e limpa a senha", async () => {
    const user = userEvent.setup();
    const api = renderView();
    await user.selectOptions(await screen.findByLabelText("Emitente"), LE);
    await user.type(screen.getByLabelText("Subutilizador (NIF/n.º)"), "admin");
    await user.type(screen.getByLabelText("Senha"), "s3gredo");
    await user.click(screen.getByRole("button", { name: "Gravar credenciais" }));
    expect(await screen.findByText(/formato NIF\/n\.º/)).toBeInTheDocument();
    expect(api.saveAtCredentials).not.toHaveBeenCalled();

    await user.clear(screen.getByLabelText("Subutilizador (NIF/n.º)"));
    await user.type(screen.getByLabelText("Subutilizador (NIF/n.º)"), "599999999/37");
    await user.click(screen.getByRole("button", { name: "Gravar credenciais" }));
    expect(api.saveAtCredentials).toHaveBeenCalledWith(LE, { username: "599999999/37", password: "s3gredo" });
    expect(screen.getByLabelText("Senha")).toHaveValue("");
  });

  it("sem certificado no servidor: aviso e botão desligado", async () => {
    renderView({ atStatus: vi.fn(async () => ({ ...STATUS, configured: false })) });
    expect(await screen.findByText("Comunicação à AT por configurar")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Comunicar agora" })).toBeDisabled();
  });
});
