import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkShift } from "../../domain/entities/schedule.ts";
import { HrProvider, type HrModule } from "../../hr.module.tsx";
import { SchedulesView } from "./SchedulesView.tsx";

vi.mock("../../../locations/adapters/in/use-locations.ts", () => ({
  useLocations: () => ({ locations: [{ id: "l1", name: "Mercado Teste", isActive: true }], activeLocations: [{ id: "l1", name: "Mercado Teste", isActive: true }], hasMultipleLocations: false, loading: false, error: null, reload: vi.fn() }),
}));

// Dados fictícios (RGPD).
const today = new Date();
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const T = { id: "t1", name: "Manhã", group: "OPENING", description: null, color: null, kind: "direct", startTime: "09:00", endTime: "15:00", endsNextDay: false, secondStartTime: null, secondEndTime: null, breakMinutes: 0, workMinutes: 360, spanMinutes: 360, locationId: null, active: true, updatedAt: "x" };
const SHIFT: WorkShift = {
  id: "s1",
  employeeId: "e1",
  employeeName: "Cláudia Teste",
  workDate: ymd(today),
  startTime: "09:00",
  endTime: "15:00",
  endsNextDay: false,
  secondStartTime: null,
  secondEndTime: null,
  locationId: "l1",
  breakMinutes: 0,
  notes: null,
  status: "published",
  source: "manual",
  rotationId: null,
  seriesId: null,
  templateId: "t1",
  automationId: null,
  attendanceStatus: "worked_as_planned",
  createdAt: "x",
  updatedAt: "x",
};

function api(over: Record<string, unknown> = {}) {
  const base: Record<string, unknown> = {
    listEmployees: vi.fn(async () => ({
      items: [
        { id: "e1", fullName: "Cláudia Teste", positionId: "p1", primaryLocationId: "l1", employmentType: "full_time", email: null, phone: null, status: "active", photoUrl: null, profileCompletionPercent: 100, documentSituation: "ok", updatedAt: "x" },
        { id: "e2", fullName: "Rui Sem Turnos", positionId: "p1", primaryLocationId: "l1", employmentType: "full_time", email: null, phone: null, status: "active", photoUrl: null, profileCompletionPercent: 100, documentSituation: "ok", updatedAt: "x" },
      ],
      total: 2,
    })),
    listPositions: vi.fn(async () => [{ id: "p1", name: "Vendas", description: null, active: true, employeeCount: 2 }]),
    listShiftTemplates: vi.fn(async () => [T]),
    listWorkShifts: vi.fn(async () => [SHIFT]),
    getScheduleAlerts: vi.fn(async () => ({ coverageGaps: [], overlaps: [{ employeeName: "Cláudia Teste", workDate: ymd(today) }], automationIssues: [], pendingPublishCount: 0, pendingPublishRange: null })),
    ...over,
  };
  return new Proxy(base, { get: (t, k: string) => t[k] ?? (async () => []) });
}

function renderView(a = api()) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <HrProvider module={{ api: a, setEmployeeKioskPin: {} } as unknown as HrModule}>
          <SchedulesView />
        </HrProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return a;
}

beforeEach(() => localStorage.clear());

describe("Escalas & Turnos — Design System", () => {
  it("cabeçalho, local, grelha semanal com a pessoa, o cargo, as horas e o turno com o nome do modelo", async () => {
    renderView();
    expect(screen.getByRole("heading", { level: 1, name: "Escalas & Turnos" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Local: Mercado Teste/ })).toBeDisabled();
    const row = (await screen.findAllByText("Cláudia Teste")).map((el) => el.closest('[role="row"]')).find(Boolean)!;
    expect(within(row as HTMLElement).getByText("Vendas")).toBeInTheDocument();
    expect(within(row as HTMLElement).getAllByText("6h").length).toBeGreaterThan(0);
    expect(within(row as HTMLElement).getByRole("button", { name: /Manhã/ })).toBeInTheDocument();
    expect(within(row as HTMLElement).getByText("Presença conferida")).toBeInTheDocument();
    expect(screen.getByText("1 pessoas atribuídas")).toBeInTheDocument();
    expect(screen.getByText("Planeamento publicado")).toBeInTheDocument();
    // Dia atual com o número destacado.
    expect(document.querySelector('[aria-current="date"]')).not.toBeNull();
  });

  it("mostrar quem não tem turnos; pesquisa; agrupar por turnos", async () => {
    renderView();
    const user = userEvent.setup();
    await screen.findAllByText("Cláudia Teste");
    expect(screen.queryAllByText("Rui Sem Turnos").length).toBe(0);
    await user.click(screen.getByRole("button", { name: "Mostrar quem não tem turnos" }));
    expect(screen.getAllByText("Rui Sem Turnos").length).toBeGreaterThan(0);
    await user.click(screen.getByRole("button", { name: "Pesquisar colaborador" }));
    await user.type(screen.getByRole("searchbox", { name: "Pesquisar colaborador" }), "rui");
    expect(screen.queryAllByText("Cláudia Teste").filter((el) => el.closest('[role="rowheader"]')).length).toBe(0);
    await user.click(screen.getByRole("radio", { name: "Turnos" }));
    expect(screen.getByRole("columnheader", { name: /Turnos/ })).toBeInTheDocument();
  });

  it("abrir o turno, atribuir pelo painel (aplicar modelo), publicar e ver os alertas", async () => {
    renderView();
    const user = userEvent.setup();
    const card = (await screen.findAllByRole("button", { name: /Manhã/ }))[0]!;
    await user.click(card);
    expect(await screen.findByRole("heading", { name: "Editar turno" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    const panel = screen.getByRole("complementary", { name: "Atribuir turnos" });
    await user.click(within(panel).getByRole("button", { name: /Manhã/ }));
    expect(await screen.findByRole("dialog", { name: /Aplicar modelo/ })).toBeInTheDocument();
  });

  it("publicar abre a revisão do período; alertas mostram as sobreposições", async () => {
    renderView();
    const user = userEvent.setup();
    await screen.findAllByText("Cláudia Teste");
    await user.click(screen.getByRole("button", { name: "1 alertas na escala" }));
    expect(screen.getByText("Conflito de sobreposição")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Publicar escala" }));
    expect(await screen.findByRole("dialog", { name: "Rever e publicar turnos" })).toBeInTheDocument();
  });
});
