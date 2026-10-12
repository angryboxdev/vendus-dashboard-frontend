import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../../../../../lib/api.ts";
import type { JoinApiPort } from "../../../domain/ports/out/invitations-api.port.ts";
import { fakeNovoRhModule } from "../../../fake-module.test-utils.ts";
import { NovoRhProvider, type NovoRhModule } from "../../../novo-rh.module.tsx";
import { InvitationsView } from "./InvitationsView.tsx";
import { JoinView } from "./JoinView.tsx";

function renderWith(m: NovoRhModule, ui: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <NovoRhProvider module={m}>
        <MemoryRouter>{ui}</MemoryRouter>
      </NovoRhProvider>
    </QueryClientProvider>,
  );
}

const mod = () =>
  fakeNovoRhModule({
    settings: { listEmployees: vi.fn(async () => []), listLocations: vi.fn(async () => [{ id: "l1", label: "Porto" }]) } as unknown as NovoRhModule["settings"],
  });

// Dados fictícios (RGPD).
const REQ = { id: "r1", invitationId: "i1", invitationState: "revoked" as const, firstName: "Ana", lastName: "Demo", email: "ana@demo.invalid", status: "pending" as const, possibleDuplicate: true, rejectReason: null, employeeId: null, createdAt: "2026-10-12T10:00:00Z" };

describe("Convites e adesões (FE-054)", () => {
  it("criar mostra o código e o link uma vez; a lista só tem o código mascarado", async () => {
    const m = mod();
    const inv = { id: "i1", maskedCode: "••••••K7P2", state: "active" as const, locationId: "l1", departmentId: null, maxUses: 5, uses: 1, expiresAt: "2026-10-26T10:00:00Z", createdBy: "rh", createdAt: "x" };
    m.invitations.list = vi.fn(async () => [inv]);
    m.invitations.create = vi.fn(async () => ({ invitation: inv, code: "ABCDEFK7P2" }));
    m.invitations.revoke = vi.fn(async () => undefined);
    renderWith(m, <InvitationsView />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: "Convites" }));
    await user.selectOptions(await screen.findByLabelText("Centro"), "l1");
    await user.click(screen.getByRole("button", { name: "Criar convite" }));
    expect(m.invitations.create).toHaveBeenCalledWith({ locationId: "l1", departmentId: null, expiresInDays: 14, maxUses: null });
    expect(await screen.findByText("ABCDEFK7P2")).toBeInTheDocument();
    expect(screen.getByText(/\/aderir\/ABCDEFK7P2$/)).toBeInTheDocument();
    const row = screen.getByText("••••••K7P2").closest("tr")!;
    expect(within(row).getByText("1/5")).toBeInTheDocument();
    await user.click(within(row).getByRole("button", { name: "Revogar" }));
    expect(m.invitations.revoke).toHaveBeenCalledWith("i1");
  });

  it("pedido: aviso de duplicado e convite revogado; recusar pede motivo; aceitar abre a criação pré-preenchida", async () => {
    const m = mod();
    m.invitations.requests = vi.fn(async () => [REQ]);
    m.invitations.reject = vi.fn(async () => undefined);
    m.invitations.accept = vi.fn(async () => ({ requestId: "r1", firstName: "Ana", lastName: "Demo", email: "ana@demo.invalid", locationId: "l1", departmentId: null, existingEmployeeId: null }));
    renderWith(m, <InvitationsView />);
    const user = userEvent.setup();
    const row = await screen.findByRole("listitem", { name: "Ana Demo" });
    expect(within(row).getByText(/Já existe uma ficha com este e-mail/)).toBeInTheDocument();
    expect(within(row).getByText(/convite revogado/)).toBeInTheDocument();
    await user.click(within(row).getByRole("button", { name: "Recusar" }));
    expect(within(row).getByRole("button", { name: "Confirmar recusa" })).toBeDisabled();
    await user.type(within(row).getByLabelText(/Motivo interno/), "Já trabalha connosco");
    await user.click(within(row).getByRole("button", { name: "Confirmar recusa" }));
    expect(m.invitations.reject).toHaveBeenCalledWith("r1", "Já trabalha connosco");
    await user.click(within(row).getByRole("button", { name: "Aceitar" }));
    expect(m.invitations.accept).toHaveBeenCalledWith("r1");
    const drawer = await screen.findByRole("dialog");
    expect(within(drawer).getByDisplayValue("Ana")).toBeInTheDocument();
    expect(within(drawer).getByDisplayValue("ana@demo.invalid")).toBeInTheDocument();
  });

  it("aceitar um pedido já tratado (409) mostra o erro", async () => {
    const m = mod();
    m.invitations.requests = vi.fn(async () => [REQ]);
    m.invitations.accept = vi.fn(async () => {
      throw new ApiError("Este pedido já foi tratado.", 409, { detail: "Este pedido já foi tratado." });
    });
    renderWith(m, <InvitationsView />);
    const user = userEvent.setup();
    await user.click(within(await screen.findByRole("listitem", { name: "Ana Demo" })).getByRole("button", { name: "Aceitar" }));
    expect(await screen.findByText("Este pedido já foi tratado.")).toBeInTheDocument();
  });
});

describe("Página pública de adesão", () => {
  function renderJoin(api: JoinApiPort) {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <JoinView code="ABCDEFK7P2" api={api} />
      </QueryClientProvider>,
    );
  }

  it("só nome, apelidos e e-mail, com consentimento; confirma o envio", async () => {
    const api: JoinApiPort = { check: vi.fn(async () => ({ valid: true, expiresAt: "2026-10-26T10:00:00Z" })), submit: vi.fn(async () => undefined) };
    renderJoin(api);
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText("Nome"), "Rui");
    await user.type(screen.getByLabelText("Apelidos"), "Demo");
    await user.type(screen.getByLabelText("E-mail"), "rui@demo.invalid");
    expect(screen.getByRole("button", { name: "Enviar pedido" })).toBeDisabled();
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Enviar pedido" }));
    expect(api.submit).toHaveBeenCalledWith("ABCDEFK7P2", { firstName: "Rui", lastName: "Demo", email: "rui@demo.invalid" });
    expect(await screen.findByText(/Pedido enviado/)).toBeInTheDocument();
  });

  it("código inválido: mensagem do servidor, sem formulário", async () => {
    renderJoin({ check: vi.fn(async () => Promise.reject(new Error("Este convite não é válido ou já expirou. Peça um novo à empresa."))), submit: vi.fn() });
    expect(await screen.findByText(/não é válido ou já expirou/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Nome")).not.toBeInTheDocument();
  });
});
