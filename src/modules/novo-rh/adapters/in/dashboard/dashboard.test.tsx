import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../../../../lib/api.ts";
import type { OperationalSnapshot, WidgetPref } from "../../../domain/entities/dashboard.ts";
import { defaultLayout, donutSegments, moveBy, moveTo, setSpan, summaryParts, toggleHidden, visibleWidgets } from "../../../domain/services/dashboard.service.ts";
import { fakeNovoRhModule } from "../../../fake-module.test-utils.ts";
import { NovoRhProvider, type NovoRhModule } from "../../../novo-rh.module.tsx";
import { DashboardView } from "./DashboardView.tsx";

// Dados fictícios (RGPD).
const SNAP: OperationalSnapshot = {
  generatedAt: "2026-10-13T10:00:00Z",
  context: { type: "organization", locationId: null, name: null },
  localDate: "2026-10-13",
  tomorrow: "2026-10-14",
  units: { operational: 2, requiringAttention: 1 },
  team: { total: 29, working: 18, remote: 2, break: 1, finished: 2, not_started: 1, vacation: 3, absent: 2, late: 1, missing: 0 },
  coverage: { uncoveredToday: 1, uncoveredTomorrow: 2, uncoveredTotal: 3 },
  requests: { pending: 3, decidable: 3 },
  attention: [
    { key: "uncovered", severity: "critical", count: 1, label: "turno sem cobertura hoje" },
    { key: "late", severity: "attention", count: 1, label: "colaborador atrasado" },
  ],
  locations: [
    { locationId: "l1", name: "Loja Porto", people: 20, present: 18, late: 1, absent: 1, missing: 0, uncovered: 1, pending: 2, state: "critical" },
    { locationId: "l2", name: "Loja Maia", people: 15, present: 15, late: 0, absent: 0, missing: 0, uncovered: 0, pending: 0, state: "normal" },
  ],
  holidays: [{ date: "2026-11-01", name: "Todos os Santos" }],
};

function mod() {
  const m = fakeNovoRhModule();
  m.dashboard.snapshot = vi.fn(async (loc: string | null) => (loc ? { ...SNAP, context: { type: "location" as const, locationId: loc, name: "Loja Porto" }, locations: [SNAP.locations[0]!] } : SNAP));
  m.dashboard.layout = vi.fn(async () => ({ layoutVersion: 1, widgets: defaultLayout(), custom: false }));
  m.dashboard.saveLayout = vi.fn(async (w: WidgetPref[]) => ({ layoutVersion: 1, widgets: w, custom: true }));
  m.dashboard.team = vi.fn(async () => ({ total: 1, page: 1, pageSize: 50, items: [{ employeeId: "e1", name: "Ana Teste", locationId: "l1", locationName: "Loja Porto", plannedStart: "09:00", plannedEnd: "17:00", firstInAt: null, lateMinutes: 0, absenceType: null }] }));
  m.dashboard.birthdays = vi.fn(async () => {
    throw new ApiError("Sem permissão", 403);
  });
  return m;
}

function renderWith(m: NovoRhModule) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <NovoRhProvider module={m}>
        <MemoryRouter>
          <DashboardView />
        </MemoryRouter>
      </NovoRhProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => localStorage.clear());

describe("Dashboard — regras puras", () => {
  it("resumo Hoje: frase determinística do mesmo agregado; zeros omitidos; contexto de local", () => {
    expect(summaryParts(SNAP).map((p) => `${p.count} ${p.label}`)).toEqual(["2 unidades operacionais", "1 precisa de atenção", "1 turno sem cobertura", "3 pedidos pendentes"]);
    const calm = { ...SNAP, units: { operational: 2, requiringAttention: 0 }, coverage: { uncoveredToday: 0, uncoveredTomorrow: 0, uncoveredTotal: 0 }, requests: { pending: 0, decidable: 0 }, attention: [] };
    expect(summaryParts(calm).map((p) => p.key)).toEqual(["units"]);
    const local = { ...SNAP, context: { type: "location" as const, locationId: "l1", name: "Loja Porto" } };
    expect(summaryParts(local).map((p) => `${p.count} ${p.label}`)).toEqual(["21 presentes", "1 atraso", "1 turno sem cobertura", "3 pedidos pendentes"]);
  });

  it("donut: arcos proporcionais, só categorias com valor", () => {
    const segs = donutSegments(SNAP.team, 100, 0);
    expect(segs.map((s) => s.category)).toEqual(["working", "remote", "break", "finished", "not_started", "vacation", "absent"]);
    expect(segs.reduce((n, s) => n + s.length, 0)).toBeCloseTo(100);
    expect(donutSegments({ ...SNAP.team, total: 0, working: 0, remote: 0, break: 0, finished: 0, not_started: 0, vacation: 0, absent: 0 }, 100)).toEqual([]);
  });

  it("registo: sem fonte, sem permissão, sem multiunidade ou oculto não aparece; layout nunca dá acesso", () => {
    const ids = (o: Parameters<typeof visibleWidgets>[1]) => visibleWidgets(defaultLayout(), o).map((w) => w.widgetId);
    const all = ids({ multiUnit: true, can: () => true, editing: false });
    expect(all).not.toContain("VACANCIES");
    expect(all).not.toContain("ARTICLES");
    expect(ids({ multiUnit: false, can: () => true, editing: false })).not.toContain("LOCATIONS_STATUS");
    expect(ids({ multiUnit: true, can: (k) => k !== "hr.employees", editing: false })).not.toContain("REPORTS");
    const hidden = toggleHidden(defaultLayout(), "HOLIDAYS");
    expect(visibleWidgets(hidden, { multiUnit: true, can: () => true, editing: false }).map((w) => w.widgetId)).not.toContain("HOLIDAYS");
    expect(visibleWidgets(hidden, { multiUnit: true, can: () => true, editing: true }).map((w) => w.widgetId)).toContain("HOLIDAYS");
  });

  it("rascunho do layout: mover, subir/descer, tamanhos só os permitidos", () => {
    const l = defaultLayout();
    expect(moveTo(l, "REQUESTS", "ATTENTION").sort((a, b) => a.order - b.order)[0]!.widgetId).toBe("REQUESTS");
    expect(moveBy(l, "ATTENTION", -1)).toBe(l);
    expect(moveBy(l, "ATTENTION", 1).sort((a, b) => a.order - b.order)[0]!.widgetId).toBe("TEAM_STATUS");
    expect(setSpan(l, "TEAM_STATUS", 12).find((w) => w.widgetId === "TEAM_STATUS")!.span).toBe(12);
    expect(setSpan(l, "TEAM_STATUS", 5)).toBe(l);
  });
});

describe("Dashboard — ecrã", () => {
  it("resumo, requer atenção, equipa e unidades a partir de um só snapshot; aniversários sem permissão não aparecem", async () => {
    const m = mod();
    renderWith(m);
    const summary = await screen.findByRole("region", { name: "Resumo de hoje" });
    expect(await within(summary).findByRole("button", { name: /2 unidades operacionais/ })).toBeInTheDocument();
    expect(within(summary).getByRole("button", { name: /3 pedidos pendentes/ })).toBeInTheDocument();
    const attention = screen.getByRole("region", { name: "Requer atenção" });
    expect(within(attention).getByRole("link", { name: /1 turno sem cobertura hoje/ })).toHaveAttribute("href", "/hr/novo/escalas");
    expect(screen.getByRole("img", { name: "29 colaboradores" })).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Estado das unidades" })).getByRole("button", { name: /Loja Porto/ })).toBeInTheDocument();
    expect(m.dashboard.snapshot).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => expect(m.dashboard.birthdays).toHaveBeenCalled());
    await vi.waitFor(() => expect(screen.queryByRole("region", { name: "Próximos aniversários" })).toBeNull());
    expect(screen.queryByRole("region", { name: "Vagas" })).toBeNull();
  });

  it("legenda e segmento do donut abrem a mesma lista, carregada só ao abrir", async () => {
    const m = mod();
    renderWith(m);
    const user = userEvent.setup();
    await screen.findByRole("img", { name: "29 colaboradores" });
    expect(m.dashboard.team).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Trabalhando: 18. Ver lista" }));
    const drawer = await screen.findByRole("dialog", { name: "Trabalhando hoje" });
    expect(await within(drawer).findByRole("link", { name: "Ana Teste" })).toHaveAttribute("href", "/hr/novo/pessoas/e1");
    expect(m.dashboard.team).toHaveBeenCalledWith("working", { locationId: null, q: "", page: 1 }, expect.anything());
  });

  it("unidade abre o detalhe sem sair; abrir no Dashboard muda o contexto (servidor filtra)", async () => {
    const m = mod();
    renderWith(m);
    const user = userEvent.setup();
    await user.click(await within(await screen.findByRole("region", { name: "Estado das unidades" })).findByRole("button", { name: /Loja Porto/ }));
    const drawer = await screen.findByRole("dialog", { name: "Loja Porto" });
    await user.click(within(drawer).getByRole("button", { name: /Abrir unidade no Dashboard/ }));
    await vi.waitFor(() => expect(m.dashboard.snapshot).toHaveBeenCalledWith("l1", expect.anything()));
  });

  it("Personalizar: ocultar e reordenar no rascunho; Cancelar não grava; Guardar envia só metadados; sem novas consultas", async () => {
    const m = mod();
    renderWith(m);
    const user = userEvent.setup();
    await screen.findByRole("img", { name: "29 colaboradores" });
    const before = (m.dashboard.snapshot as ReturnType<typeof vi.fn>).mock.calls.length;
    await user.click(screen.getByRole("button", { name: "Personalizar" }));
    const panel = screen.getByRole("complementary", { name: "Personalizar painel" });
    await user.click(within(panel).getByRole("checkbox", { name: "Mostrar Próximos feriados" }));
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(m.dashboard.saveLayout).not.toHaveBeenCalled();
    expect(screen.getByRole("region", { name: "Próximos feriados" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Personalizar" }));
    const panel2 = screen.getByRole("complementary", { name: "Personalizar painel" });
    await user.click(within(panel2).getByRole("button", { name: "Descer Requer atenção" }));
    await user.click(within(panel2).getByRole("checkbox", { name: "Mostrar Próximos feriados" }));
    await user.click(screen.getByRole("button", { name: "Guardar layout" }));
    await vi.waitFor(() => expect(m.dashboard.saveLayout).toHaveBeenCalledTimes(1));
    const sent = (m.dashboard.saveLayout as ReturnType<typeof vi.fn>).mock.calls[0]![0] as WidgetPref[];
    expect(Object.keys(sent[0]!).sort()).toEqual(["hidden", "order", "span", "widgetId"]);
    expect(sent[0]!.widgetId).toBe("TEAM_STATUS");
    expect(sent.find((w) => w.widgetId === "HOLIDAYS")!.hidden).toBe(true);
    expect((m.dashboard.snapshot as ReturnType<typeof vi.fn>).mock.calls.length).toBe(before);
    await vi.waitFor(() => expect(screen.queryByRole("region", { name: "Próximos feriados" })).toBeNull());
  });

  it("falha de um widget não derruba o resto", async () => {
    const m = mod();
    m.reports.catalog = vi.fn(async () => {
      throw new Error("x");
    });
    renderWith(m);
    expect(await screen.findByText("Não foi possível carregar os relatórios.")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "29 colaboradores" })).toBeInTheDocument();
  });
});

describe("Dashboard — erros e fontes parciais", () => {
  it("resumo a falhar mostra o código e a mensagem (não fica em branco)", async () => {
    const m = mod();
    m.dashboard.snapshot = vi.fn(async () => {
      throw new ApiError("Erro interno", 500);
    });
    renderWith(m);
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Não foi possível carregar o Dashboard agora.");
    expect(alert).toHaveTextContent("500 · Erro interno");
    expect(screen.getAllByText("Sem dados (o resumo não carregou).").length).toBeGreaterThan(0);
  });

  it("cobertura indisponível: o widget avisa e o resto funciona", async () => {
    const m = mod();
    m.dashboard.snapshot = vi.fn(async () => ({ ...SNAP, partial: ["coverage" as const] }));
    renderWith(m);
    expect(await screen.findByText("Cobertura temporariamente indisponível.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tentar novamente" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "29 colaboradores" })).toBeInTheDocument();
  });

  it("pedidos indisponíveis: erro só no widget (com 'Tentar novamente'), sem aviso global; cartões com a altura do conteúdo", async () => {
    const m = mod();
    m.dashboard.snapshot = vi.fn(async () => ({ ...SNAP, partial: ["requests" as const] }));
    renderWith(m);
    expect(await screen.findByText("Pedidos temporariamente indisponíveis.")).toBeInTheDocument();
    expect(screen.queryByText(/não puderam ser contados/)).toBeNull();
    expect(screen.getByRole("img", { name: "29 colaboradores" })).toBeInTheDocument();
    const before = vi.mocked(m.dashboard.snapshot).mock.calls.length;
    await userEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(vi.mocked(m.dashboard.snapshot).mock.calls.length).toBeGreaterThan(before);
    expect(document.querySelector("#widget-ATTENTION")!.parentElement!.className).toMatch(/items-start/);
  });
});

describe("Dashboard — a preparar", () => {
  it("503 'a preparar': tenta de novo sozinho e mostra os dados quando ficam prontos", async () => {
    const m = mod();
    let n = 0;
    m.dashboard.snapshot = vi.fn(async () => {
      if (++n === 1) throw new ApiError("A preparar os dados de hoje.", 503);
      return SNAP;
    });
    renderWith(m);
    expect(await screen.findByText(/está a demorar mais do que o normal/)).toBeInTheDocument();
    expect(await screen.findByRole("img", { name: "29 colaboradores" }, { timeout: 6000 })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  }, 10_000);
});
