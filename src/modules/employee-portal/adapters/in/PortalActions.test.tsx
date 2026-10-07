import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { MyDocument, MyRequest } from "../../domain/entities/portal.ts";
import type { PortalSelfServicePort } from "../../domain/ports/in/portal.ports.ts";
import { EmployeePortalProvider, type EmployeePortalModule } from "../../employee-portal.module.tsx";
import { PortalDocumentsView } from "./PortalDocumentsView.tsx";
import { PortalRequestsSection } from "./PortalRequestsSection.tsx";

// Dados fictícios (RGPD).
function renderWith(ui: ReactNode, selfService: Partial<PortalSelfServicePort>) {
  const mod: EmployeePortalModule = {
    getHome: { execute: vi.fn() },
    registerPunch: { execute: vi.fn() },
    selfService: selfService as PortalSelfServicePort,
    newIdempotencyKey: () => "k",
  };
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <EmployeePortalProvider module={mod}>{ui}</EmployeePortalProvider>
    </QueryClientProvider>,
  );
}

const EXPIRED: MyDocument = {
  id: "d1",
  categoryLabel: "Atestado de saúde",
  fileName: "a.pdf",
  status: "valid",
  canReplace: true,
  lastRejection: { note: "Foto ilegível", at: "2026-10-06T10:00:00Z" },
  period: null,
  isPayslip: false,
  issuedAt: null,
  expiresAt: "2020-01-31",
  uploadedAt: "",
};

describe("Portal — substituir documento", () => {
  it("mostra a rejeição anterior e envia o ficheiro escolhido", async () => {
    const replaceDocument = vi.fn(async () => ({ ...EXPIRED, status: "pending_validation", canReplace: false }));
    renderWith(<PortalDocumentsView />, { listDocuments: vi.fn(async () => [EXPIRED]), replaceDocument });
    const user = userEvent.setup();
    expect(await screen.findByText("Envio rejeitado: Foto ilegível")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Substituir" }));
    const file = new File(["x"], "novo.pdf", { type: "application/pdf" });
    await user.upload(screen.getByLabelText("Novo ficheiro (PDF ou foto)"), file);
    await user.click(screen.getByRole("button", { name: "Enviar" }));
    expect(replaceDocument).toHaveBeenCalledWith("d1", file, null);
    expect(await screen.findByText(/Enviado ✓/)).toBeInTheDocument();
  });

  it("em validação: sem botão Substituir", async () => {
    renderWith(<PortalDocumentsView />, { listDocuments: vi.fn(async () => [{ ...EXPIRED, status: "pending_validation", canReplace: false, lastRejection: null }]) });
    expect(await screen.findByText("Em validação pelo RH")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Substituir" })).not.toBeInTheDocument();
  });
});

describe("Portal — pedidos", () => {
  const PENDING: MyRequest = {
    id: "r1",
    kind: "day_off",
    status: "pending",
    workShiftId: null,
    startDate: "2026-10-12",
    endDate: "2026-10-12",
    reasonLabel: "Assunto pessoal",
    reasonText: null,
    attachmentName: null,
    decisionNote: null,
    decidedAt: null,
    createdAt: "",
  };

  it("pedir folga envia as datas e o motivo; pendente pode ser cancelado", async () => {
    const createRequest = vi.fn(async () => PENDING);
    const cancelRequest = vi.fn(async () => ({ ...PENDING, status: "cancelled" as const }));
    renderWith(<PortalRequestsSection />, { listRequests: vi.fn(async () => [PENDING]), createRequest, cancelRequest });
    const user = userEvent.setup();

    expect(await screen.findByText("Pendente")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancelar pedido" }));
    expect(cancelRequest).toHaveBeenCalledWith("r1");

    await user.click(screen.getByRole("button", { name: "Pedir folga" }));
    await user.type(screen.getByLabelText("De"), "2030-01-10");
    await user.selectOptions(screen.getByLabelText("Motivo"), "personal");
    await user.click(screen.getByRole("button", { name: "Enviar ao gerente" }));
    expect(createRequest).toHaveBeenCalledWith({ kind: "day_off", startDate: "2030-01-10", endDate: "2030-01-10", reasonCode: "personal", reasonText: null });
  });

  it("rejeitado mostra o motivo do gerente", async () => {
    renderWith(<PortalRequestsSection />, { listRequests: vi.fn(async () => [{ ...PENDING, status: "rejected" as const, decisionNote: "Dia de evento" }]) });
    expect(await screen.findByText("Dia de evento")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancelar pedido" })).not.toBeInTheDocument();
  });
});
