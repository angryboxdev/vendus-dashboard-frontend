import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { parseChecklist, parseOptions } from "../../../domain/services/engagement.service.ts";
import { fakeNovoRhModule } from "../../../fake-module.test-utils.ts";
import { NovoRhProvider, type NovoRhModule } from "../../../novo-rh.module.tsx";
import { AlertsView } from "./AlertsView.tsx";
import { AnnouncementsView } from "./AnnouncementsView.tsx";
import { ReportsView } from "./ReportsView.tsx";
import { WorkspaceView } from "./WorkspaceView.tsx";

function renderWith(m: NovoRhModule, ui: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <NovoRhProvider module={m}>{ui}</NovoRhProvider>
    </QueryClientProvider>,
  );
}

const mod = () =>
  fakeNovoRhModule({
    settings: { listEmployees: vi.fn(async () => [{ id: "e1", label: "Ana Teste" }]), listLocations: vi.fn(async () => [{ id: "l1", label: "Porto" }]) } as unknown as NovoRhModule["settings"],
  });

describe("Fase 9 — regras do ecrã", () => {
  it("checklist com obrigatórios e opções sem repetidos", () => {
    expect(parseChecklist("* Ligar fornos\nFoto da montra\n\n*  ")).toEqual([
      { text: "Ligar fornos", required: true },
      { text: "Foto da montra", required: false },
    ]);
    expect(parseOptions("S, M, , L, M")).toEqual(["S", "M", "L"]);
  });
});

describe("Comunicados", () => {
  const PUBLISHED = { id: "a1", status: "published" as const, audience: { type: "all" as const }, requiresConfirmation: true, currentVersion: 2, title: "Fardamento", body: "v2", publishedAt: "2026-10-12T10:00:00Z" };

  it("RE_32_relatorio_mostra_entregue_lido_confirmado_por_versao", async () => {
    const m = mod();
    m.announcements.list = vi.fn(async () => [PUBLISHED]);
    m.announcements.report = vi.fn(async () => ({
      announcement: PUBLISHED,
      versions: [],
      totals: { recipients: 1, read: 1, confirmed: 1 },
      rows: [{ employeeId: "e1", version: 2, deliveredAt: "2026-10-12T10:00:00Z", readAt: "2026-10-12T11:00:00Z", confirmedAt: "2026-10-12T11:05:00Z", status: "confirmed" as const }],
    }));
    renderWith(m, <AnnouncementsView />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /Fardamento/ }));
    expect(await screen.findByText("1 destinatário(s) · 1 leram · 1 confirmaram (versão 2)")).toBeInTheDocument();
    const row = screen.getByText("Ana Teste").closest("tr")!;
    expect(within(row).getByText("Confirmado")).toBeInTheDocument();
    expect(within(row).getByText("2026-10-12 11:05")).toBeInTheDocument();
  });

  it("o colaborador confirma a leitura", async () => {
    const m = mod();
    m.announcements.mine = vi.fn(async () => [{ id: "a1", title: "Fardamento", body: "Novo fardamento", version: 1, publishedAt: "x", requiresConfirmation: true, readAt: null, confirmedAt: null }]);
    m.announcements.confirm = vi.fn(async () => undefined);
    renderWith(m, <AnnouncementsView />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: "Os meus" }));
    await user.click(await screen.findByRole("button", { name: "Confirmo que li" }));
    expect(m.announcements.confirm).toHaveBeenCalledWith("a1");
  });
});

describe("Alertas", () => {
  it("RE_36_tratar_e_fechar_com_nota", async () => {
    const m = mod();
    m.alerts.list = vi.fn(async () => [{ id: "al1", ruleId: "r", sourceType: "absence_request", sourceId: "x", employeeId: "e1", title: "Ausência pendente", status: "open" as const, dueAt: "2099-01-01T00:00:00Z", escalatedAt: null, takenBy: null, closedBy: null, closeNote: null }]);
    m.alerts.take = vi.fn(async () => ({}) as never);
    m.alerts.close = vi.fn(async () => ({}) as never);
    renderWith(m, <AlertsView />);
    const user = userEvent.setup();
    const row = (await screen.findByText("Ausência pendente")).closest("li")!;
    await user.click(within(row).getByRole("button", { name: "Tratar" }));
    expect(m.alerts.take).toHaveBeenCalledWith("al1");
    const close = within(row).getByRole("button", { name: "Fechar" });
    expect(close).toBeDisabled();
    await user.type(within(row).getByLabelText(/Como ficou resolvido/), "Aprovada");
    await user.click(close);
    expect(m.alerts.close).toHaveBeenCalledWith("al1", "Aprovada");
  });

  it("RE_24_regra_pendente_ha_N_dias_com_escalonamento", async () => {
    const m = mod();
    m.alerts.createRule = vi.fn(async () => ({}) as never);
    renderWith(m, <AlertsView />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: "Regras" }));
    const box = await screen.findByRole("group", { name: "Nova regra" });
    await user.selectOptions(within(box).getByLabelText("Escalar para"), "admins");
    await user.click(within(box).getByRole("button", { name: "Nova regra" }));
    expect(m.alerts.createRule).toHaveBeenCalledWith({ kind: "pending_absence", thresholdDays: 3, owner: "admins", slaHours: 24, escalateTo: "admins", enabled: true });
  });
});

describe("Tarefas e Quem está", () => {
  it("criar tarefa com checklist (obrigatórios com *)", async () => {
    const m = mod();
    m.workspace.createTask = vi.fn(async () => ({}) as never);
    renderWith(m, <WorkspaceView />);
    const user = userEvent.setup();
    const box = screen.getByRole("region", { name: "Nova tarefa" });
    await user.type(within(box).getByLabelText("Título"), "Abertura");
    await user.type(within(box).getByLabelText(/Checklist/), "* Ligar fornos{enter}Foto");
    await user.click(within(box).getByRole("button", { name: "Criar tarefa" }));
    expect(m.workspace.createTask).toHaveBeenCalledWith({ title: "Abertura", description: null, assigneeEmployeeId: null, dueAt: null, checklist: [{ text: "Ligar fornos", required: true }, { text: "Foto", required: false }] });
  });

  it("CF_15_quem_esta_mostra_o_ambito_e_so_o_que_a_API_devolve", async () => {
    const m = mod();
    m.workspace.whosIn = vi.fn(async () => ({ scope: "own_location" as const, people: [{ employeeId: "e9", name: "Gestora", state: "work", since: "2026-10-12T08:00:00Z" }] }));
    renderWith(m, <WorkspaceView />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: "Quem está" }));
    expect(await screen.findByText("A mostrar só o seu centro.")).toBeInTheDocument();
    expect(screen.getByText("Gestora")).toBeInTheDocument();
    expect(screen.getByText("desde 08:00")).toBeInTheDocument();
  });
});

describe("Relatórios", () => {
  it("escolher, ver e descarregar CSV", async () => {
    const m = mod();
    const def = { key: "incomplete_data", label: "Dados incompletos", description: "…", needsPeriod: false, columns: [{ key: "employee", label: "Colaborador" }, { key: "missing", label: "Em falta" }] };
    m.reports.catalog = vi.fn(async () => [def]);
    m.reports.run = vi.fn(async () => ({ definition: def, rows: [{ employee: "Ana Teste", missing: "NIF" }] }));
    m.reports.csv = vi.fn(async () => new Blob(["x"]));
    URL.createObjectURL = vi.fn(() => "blob:x");
    URL.revokeObjectURL = vi.fn();
    renderWith(m, <ReportsView />);
    const user = userEvent.setup();
    await screen.findByRole("option", { name: "Dados incompletos" });
    await user.selectOptions(screen.getByLabelText("Relatório"), "incomplete_data");
    await user.click(screen.getByRole("button", { name: "Ver" }));
    expect(await screen.findByText("NIF")).toBeInTheDocument();
    expect(m.reports.run).toHaveBeenCalledWith("incomplete_data", null);
    await user.click(screen.getByRole("button", { name: "Descarregar CSV" }));
    expect(m.reports.csv).toHaveBeenCalledWith("incomplete_data", null);
  });
});
