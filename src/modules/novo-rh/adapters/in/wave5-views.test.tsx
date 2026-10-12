import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../../../../lib/api.ts";
import type { ExportJob } from "../../domain/entities/periods.ts";
import { describeError, safeInternalLink } from "../../domain/services/errors.service.ts";
import { pollInterval, transferState } from "../../domain/services/transfers.service.ts";
import { screenFor, searchScreens } from "../../domain/services/screens.registry.ts";
import { fakeNovoRhModule } from "../../fake-module.test-utils.ts";
import { NovoRhProvider, type NovoRhModule } from "../../novo-rh.module.tsx";
import { ErrorPanel } from "./common/ErrorPanel.tsx";
import { NotFoundView } from "./common/NotFoundView.tsx";
import { NotificationsView } from "./NotificationsView.tsx";
import { TransfersView } from "./TransfersView.tsx";

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>;
}

function renderWith(m: NovoRhModule, ui: ReactNode, path = "/hr/novo/x") {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <NovoRhProvider module={m} modeStore={{ load: () => "real", save: () => {} }}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="*" element={ui} />
          </Routes>
          <Where />
        </MemoryRouter>
      </NovoRhProvider>
    </QueryClientProvider>,
  );
}

describe("Onda 5 — regras", () => {
  it("FE-002: registo de ecrãs — ecrã do caminho e pesquisa sem acentos", () => {
    expect(screenFor("/hr/novo")?.label).toBe("novoRh.tab.overview");
    expect(screenFor("/hr/novo/pessoas/e1")?.label).toBe("novoRh.tab.people");
    expect(screenFor("/hr/novo/nao-existe")).toBeNull();
    const label = (s: { label: string }) => ({ "novoRh.tab.transfers": "Transferências", "novoRh.tab.reports": "Relatórios" })[s.label] ?? s.label;
    expect(searchScreens("transferencias", label).map((s) => s.path)).toEqual(["/hr/novo/transferencias"]);
    expect(searchScreens("  ", label)).toEqual([]);
  });

  it("só ligações internas (sem redirecionamento aberto)", () => {
    expect(safeInternalLink("/hr/novo/pedidos")).toBe("/hr/novo/pedidos");
    expect(safeInternalLink("//evil.example")).toBeNull();
    expect(safeInternalLink("https://evil.example")).toBeNull();
    expect(safeInternalLink("/\\evil")).toBeNull();
    expect(safeInternalLink(null)).toBeNull();
  });

  it("erro com o detalhe e o ID de correlação do backend", () => {
    const e = new ApiError("x", 409, { detail: "Já existe.", correlationId: "c-123" });
    expect(describeError(e, "Erro")).toEqual({ status: 409, message: "Já existe.", correlationId: "c-123" });
    expect(describeError("?", "Erro")).toEqual({ status: null, message: "Erro", correlationId: null });
  });

  it("transferências: expirada depois da data; acompanhamento 5 s → 30 s e parado sem pedidos em curso", () => {
    const now = new Date("2026-10-12T12:00:00Z");
    expect(transferState({ status: "done", expiresAt: "2026-10-12T11:00:00Z" }, now)).toBe("expired");
    expect(transferState({ status: "done", expiresAt: "2026-10-13T11:00:00Z" }, now)).toBe("ready");
    expect(transferState({ status: "failed", expiresAt: null }, now)).toBe("failed");
    expect(pollInterval([{ status: "running" }], 0)).toBe(5000);
    expect(pollInterval([{ status: "queued" }], 5)).toBe(30000);
    expect(pollInterval([{ status: "done" }], 3)).toBe(false);
  });
});

describe("Centro de notificações (FE-004)", () => {
  it("abrir marca como lida e navega só para rotas internas; pendentes à parte", async () => {
    const m = fakeNovoRhModule();
    m.notifications.list = vi.fn(async () => [
      { id: "n1", kind: "x", title: "Pedido aprovado", body: null, link: "/hr/novo/ausencias", createdAt: "2026-10-12T10:00:00Z", readAt: null },
      { id: "n2", kind: "x", title: "Externa", body: null, link: "https://evil.example", createdAt: "2026-10-12T09:00:00Z", readAt: null },
    ]);
    m.notifications.markRead = vi.fn(async () => undefined);
    m.inbox.list = vi.fn(async () => ({ types: ["leave" as const, "clock" as const], counters: { leave: { mine: 2, others: 0 }, clock: { mine: 0, others: 1 } }, items: [] }));
    renderWith(m, <NotificationsView />);
    const user = userEvent.setup();
    expect(m.notifications.list).toHaveBeenCalledWith({ unreadOnly: true, limit: 100 });
    const pending = await screen.findByRole("region", { name: "Pedidos por decidir" });
    expect(await within(pending).findByRole("link", { name: /Ausências\s*2/ })).toHaveAttribute("href", "/hr/novo/pedidos");
    expect(within(pending).queryByText("Correções de ponto")).not.toBeInTheDocument();
    await user.click(await screen.findByRole("button", { name: /Externa/ }));
    expect(m.notifications.markRead).toHaveBeenCalledWith("n2");
    expect(screen.getByTestId("where")).toHaveTextContent("/hr/novo/x");
    await user.click(screen.getByRole("button", { name: /Pedido aprovado/ }));
    expect(screen.getByTestId("where")).toHaveTextContent("/hr/novo/ausencias");
  });
});

describe("Centro de transferências (FE-005)", () => {
  it("pronta descarrega; expirada executa de novo com os mesmos parâmetros", async () => {
    const m = fakeNovoRhModule();
    const base = { periodId: "p1", kind: "payroll" as const, error: null, fileName: "salarios.csv", createdAt: "2026-10-10T10:00:00Z" };
    const jobs: ExportJob[] = [
      { ...base, id: "j1", status: "done", includeSensitive: false, expiresAt: "2099-01-01T00:00:00Z" },
      { ...base, id: "j2", status: "done", includeSensitive: true, expiresAt: "2026-01-01T00:00:00Z" },
    ];
    m.periods.exports = vi.fn(async () => jobs);
    m.periods.download = vi.fn(async () => ({ blob: new Blob(["a"]), fileName: "salarios.csv" }));
    m.periods.requestExport = vi.fn(async () => ({ ...jobs[1]!, id: "j3", status: "queued" as const }));
    URL.createObjectURL = vi.fn(() => "blob:x");
    URL.revokeObjectURL = vi.fn();
    renderWith(m, <TransfersView />);
    const user = userEvent.setup();
    const ready = (await screen.findByText("Pronta")).closest("tr")!;
    await user.click(within(ready).getByRole("button", { name: "Descarregar" }));
    expect(m.periods.download).toHaveBeenCalledWith(jobs[0]);
    const expired = screen.getByText("Expirada").closest("tr")!;
    expect(within(expired).queryByRole("button", { name: "Descarregar" })).not.toBeInTheDocument();
    await user.click(within(expired).getByRole("button", { name: "Executar de novo" }));
    expect(m.periods.requestExport).toHaveBeenCalledWith("p1", "payroll", true);
  });
});

describe("Erros e estados globais (FE-006)", () => {
  it("404 com foco no título e regresso ao início", async () => {
    renderWith(fakeNovoRhModule(), <NotFoundView />, "/hr/novo/nao-existe");
    const h1 = await screen.findByRole("heading", { name: "Página não encontrada" });
    expect(h1).toHaveFocus();
    expect(screen.getByRole("link", { name: "Voltar ao início" })).toHaveAttribute("href", "/hr/novo");
    expect(screen.getByTestId("where")).toHaveTextContent("/hr/novo/nao-existe");
  });

  it("painel de erro com ID de correlação e tentar de novo; 403 sem detalhes do recurso", async () => {
    const retry = vi.fn();
    const { unmount } = render(<ErrorPanel error={new ApiError("falhou", 500, { correlationId: "c-9" })} onRetry={retry} />);
    expect(screen.getByText("ID do pedido: c-9")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(retry).toHaveBeenCalled();
    unmount();
    render(<ErrorPanel error={new ApiError("Pessoa X do centro Y", 403, {})} onRetry={retry} />);
    expect(screen.getByText(/Não tem permissão/)).toBeInTheDocument();
    expect(screen.queryByText("Pessoa X do centro Y")).not.toBeInTheDocument();
  });
});
