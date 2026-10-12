import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { PortalRequestError } from "../../domain/entities/portal.ts";
import type { PortalEngagementPort } from "../../domain/ports/in/portal.ports.ts";
import { EmployeePortalProvider, type EmployeePortalModule } from "../../employee-portal.module.tsx";
import { PortalMoreView } from "./PortalMoreView.tsx";
import { PortalNewsView } from "./PortalNewsView.tsx";
import { PortalCustomRequestsView, PortalTasksView, PortalTimeBankView } from "./PortalWorkViews.tsx";

// Dados fictícios (RGPD).
function renderWith(ui: ReactNode, engagement: Partial<PortalEngagementPort>) {
  const mod: EmployeePortalModule = {
    getHome: { execute: vi.fn() },
    registerPunch: { execute: vi.fn() },
    selfService: {} as EmployeePortalModule["selfService"],
    engagement: engagement as PortalEngagementPort,
    newIdempotencyKey: () => "k",
  };
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <EmployeePortalProvider module={mod}>
        <MemoryRouter>{ui}</MemoryRouter>
      </EmployeePortalProvider>
    </QueryClientProvider>,
  );
}

describe("Portal — onda 6", () => {
  it("Mais: mostra quantas coisas pedem ação", async () => {
    renderWith(<PortalMoreView />, { pendingCount: vi.fn(async () => 3) });
    expect(await screen.findByLabelText("3 por tratar")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Banco de horas/ })).toHaveAttribute("href", "/portal/banco-de-horas");
  });

  it("documento enviado: só confirma depois de abrir; comunicado confirma-se depois de ler", async () => {
    const confirmDistribution = vi.fn(async () => undefined);
    const confirmAnnouncement = vi.fn(async () => undefined);
    const openAnnouncement = vi.fn(async () => undefined);
    renderWith(<PortalNewsView />, {
      inbox: vi.fn(async () => ({
        distributions: [
          { id: "d1", title: "Normas de segurança", fileName: "normas.pdf", requiresConfirmation: true, createdAt: "2026-10-10T09:00:00Z", readAt: null, confirmedAt: null },
          { id: "d2", title: "Regulamento", fileName: "reg.pdf", requiresConfirmation: true, createdAt: "2026-10-09T09:00:00Z", readAt: "2026-10-11T09:00:00Z", confirmedAt: null },
        ],
        announcements: [{ id: "a1", title: "Fardamento", body: "Novo fardamento a partir de segunda.", version: 1, publishedAt: "2026-10-12T09:00:00Z", requiresConfirmation: true, readAt: null, confirmedAt: null }],
      })),
      confirmDistribution,
      confirmAnnouncement,
      openAnnouncement,
    });
    const user = userEvent.setup();
    const d1 = await screen.findByRole("article", { name: "Normas de segurança" });
    expect(within(d1).getByRole("button", { name: "Confirmo que li" })).toBeDisabled();
    const d2 = screen.getByRole("article", { name: "Regulamento" });
    await user.click(within(d2).getByRole("button", { name: "Confirmo que li" }));
    expect(confirmDistribution).toHaveBeenCalledWith("d2");
    const a1 = screen.getByRole("article", { name: "Fardamento" });
    await user.click(within(a1).getByRole("button", { name: /Fardamento/ }));
    expect(openAnnouncement).toHaveBeenCalledWith("a1");
    expect(within(a1).getByText("Novo fardamento a partir de segunda.")).toBeInTheDocument();
    await user.click(within(a1).getByRole("button", { name: "Confirmo que li" }));
    expect(confirmAnnouncement).toHaveBeenCalledWith("a1");
  });

  it("tarefa: conclui só com os obrigatórios feitos", async () => {
    const toggleItem = vi.fn(async () => ({}) as never);
    renderWith(<PortalTasksView />, {
      tasks: vi.fn(async () => [
        {
          id: "t1",
          title: "Abertura da loja",
          description: null,
          dueAt: null,
          status: "open" as const,
          checklist: [
            { id: "i1", text: "Ligar fornos", required: true, done: false },
            { id: "i2", text: "Foto da montra", required: false, done: false },
          ],
        },
      ]),
      toggleItem,
      completeTask: vi.fn(),
    });
    const user = userEvent.setup();
    expect(await screen.findByRole("button", { name: "Concluir tarefa" })).toBeDisabled();
    expect(screen.getByText("Faltam 1 item(ns) obrigatório(s).")).toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: /Ligar fornos/ }));
    expect(toggleItem).toHaveBeenCalledWith("t1", "i1", true);
  });

  it("solicitação: obrigatórias assinaladas e envio com as respostas", async () => {
    const submitCustomRequest = vi.fn(async () => ({ id: "r1", formId: "f1", answers: {}, status: "pending" as const, dueAt: null, decisionComment: null, createdAt: "2026-10-12T10:00:00Z" }));
    renderWith(<PortalCustomRequestsView />, {
      forms: vi.fn(async () => [{ id: "f1", title: "Fardamento", responseDays: 3, fields: [{ id: "size", title: "Tamanho", type: "single" as const, options: ["S", "M"], required: true }] }]),
      customRequests: vi.fn(async () => [{ id: "r0", formId: "f1", answers: {}, status: "rejected" as const, dueAt: null, decisionComment: "Sem stock.", createdAt: "2026-10-01T10:00:00Z" }]),
      submitCustomRequest,
    });
    const user = userEvent.setup();
    expect(await screen.findByText("Sem stock.")).toBeInTheDocument();
    await user.selectOptions(await screen.findByLabelText("Formulário"), "f1");
    await user.click(screen.getByRole("button", { name: "Enviar solicitação" }));
    expect(screen.getByText("Resposta obrigatória.")).toBeInTheDocument();
    expect(submitCustomRequest).not.toHaveBeenCalled();
    await user.click(screen.getByRole("radio", { name: "M" }));
    await user.click(screen.getByRole("button", { name: "Enviar solicitação" }));
    expect(submitCustomRequest).toHaveBeenCalledWith(expect.objectContaining({ id: "f1" }), { size: "M" });
  });

  it("banco de horas: saldo; se a empresa não o mostra, explica porquê", async () => {
    renderWith(<PortalTimeBankView />, {
      timeBank: vi.fn(async () => ({ cutoff: "2026-09-30", balance: 5400, available: 5400, generated: 7200, compensatedRest: -1800, compensatedPaid: 0, expired: 0, entries: [{ id: "e1", kind: "excess", seconds: 7200, workDate: "2026-09-10", reason: "", running: 7200 }] })),
    });
    expect(await screen.findByText("1h 30m")).toBeInTheDocument();
    expect(screen.getByText("Excedente de tempo")).toBeInTheDocument();
  });

  it("banco de horas oculto pela empresa", async () => {
    renderWith(<PortalTimeBankView />, { timeBank: vi.fn(async () => Promise.reject(new PortalRequestError("O histórico do banco de horas não está visível para os colaboradores."))) });
    expect(await screen.findByText(/não está visível/)).toBeInTheDocument();
  });
});
