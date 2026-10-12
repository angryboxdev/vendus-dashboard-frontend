import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { Overview, PersonDayView, PersonOverview } from "../../../domain/entities/overview.ts";
import { fakeNovoRhModule } from "../../../fake-module.test-utils.ts";
import { NovoRhProvider } from "../../../novo-rh.module.tsx";
import { OverviewDashboard } from "./OverviewDashboard.tsx";

const dayOf = (date: string, over: Partial<PersonDayView> = {}): PersonDayView => ({
  date,
  status: "finished",
  lateMinutes: 0,
  workedSeconds: 8 * 3600,
  theoreticalSeconds: 8 * 3600,
  plannedStart: "09:00",
  plannedEnd: "17:00",
  firstInAt: `${date}T08:00:00Z`,
  absenceType: null,
  ...over,
});
const person = (id: string, name: string, loc: string, today: Partial<PersonDayView>): PersonOverview => ({
  ...dayOf("2026-10-12", today),
  employeeId: id,
  name,
  locationId: loc,
  locationName: loc === "l1" ? "Porto" : "Braga",
  week: [dayOf("2026-10-11"), dayOf("2026-10-12", today)],
});

const OVERVIEW: Overview = {
  date: "2026-10-12",
  today: "2026-10-12",
  timeZone: "Europe/Lisbon",
  generatedAt: "2026-10-12T10:00:00Z",
  kpis: { people: 3, scheduled: 3, working: 1, remote: 0, onBreak: 0, finished: 0, absent: 1, missing: 1, late: 1, notStarted: 0 },
  people: [
    person("e-rui", "Rui Demo", "l1", { status: "missing", firstInAt: null, workedSeconds: 0 }),
    person("e-ana", "Ana Demo", "l1", { status: "working", lateMinutes: 20, firstInAt: "2026-10-12T08:20:00Z", workedSeconds: 3600 }),
    person("e-eva", "Eva Demo", "l2", { status: "absent", firstInAt: null, workedSeconds: 0, absenceType: "Férias" }),
  ],
  locations: [
    { locationId: "l2", name: "Braga", people: 1, present: 0, absent: 1, missing: 0, late: 0 },
    { locationId: "l1", name: "Porto", people: 2, present: 1, absent: 0, missing: 1, late: 1 },
  ],
  week: [
    { date: "2026-10-11", late: 0, missing: 0, absent: 0, workedSeconds: 0, theoreticalSeconds: 0 },
    { date: "2026-10-12", late: 1, missing: 1, absent: 1, workedSeconds: 0, theoreticalSeconds: 0 },
  ],
  pending: { absenceRequests: 2, corrections: 0, incidents: 3, customRequests: 0, alerts: 1 },
  holidays: [{ date: "2026-11-01", name: "Dia de Todos os Santos" }],
};

function renderDashboard() {
  const mod = fakeNovoRhModule({ overview: { get: vi.fn(async () => OVERVIEW) } });
  mod.attendance.days = vi.fn(async () => ({
    employeeId: "e-ana",
    timeZone: "Europe/Lisbon",
    days: [],
    totals: { workedSeconds: 0, theoreticalSeconds: 0, excessSeconds: 0, pendingSeconds: 0, nightSeconds: 0 },
    events: [{ id: "ev1", employeeId: "e-ana", occurredAt: "2026-10-12T08:20:00Z", segmentType: "work" as const, source: "web", locationId: null }],
    revisions: [],
    incidents: [],
    refusable: [],
  }));
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <NovoRhProvider module={mod} modeStore={{ load: () => "real", save: () => {} }}>
        <MemoryRouter>
          <OverviewDashboard />
        </MemoryRouter>
      </NovoRhProvider>
    </QueryClientProvider>,
  );
  return mod;
}

describe("Painel do dia", () => {
  it("números do dia, faltas primeiro, atraso em minutos, pendentes com ligação", async () => {
    renderDashboard();
    const kpis = await screen.findByRole("group", { name: "Números do dia" });
    expect(within(kpis).getByRole("button", { name: /Faltas\s*1/ })).toBeInTheDocument();
    expect(within(kpis).getByRole("button", { name: /Atrasos\s*1/ })).toBeInTheDocument();
    const rows = screen.getAllByRole("row");
    expect(rows[1]).toHaveTextContent("Rui Demo");
    expect(rows[1]).toHaveTextContent("Falta");
    expect(screen.getByText("20 min atraso")).toBeInTheDocument();
    expect(screen.getByText("Férias")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Pedidos de ausência\s*2/ })).toHaveAttribute("href", "/hr/novo/ausencias");
    expect(screen.getByText("Dia de Todos os Santos")).toBeInTheDocument();
  });

  it("clicar em Atrasos filtra a lista; o centro também filtra", async () => {
    renderDashboard();
    await userEvent.click(await screen.findByRole("button", { name: /Atrasos\s*1/ }));
    expect(screen.getByText("Ana Demo")).toBeInTheDocument();
    expect(screen.queryByText("Rui Demo")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Limpar filtro" }));
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Centro" }), "l2");
    expect(screen.getByText("Eva Demo")).toBeInTheDocument();
    expect(screen.queryByText("Ana Demo")).not.toBeInTheDocument();
  });

  it("clicar numa pessoa abre o detalhe: marcações do dia, 7 dias e ligações", async () => {
    const mod = renderDashboard();
    await userEvent.click(await screen.findByRole("button", { name: "Ana Demo" }));
    expect(mod.attendance.days).toHaveBeenCalledWith("e-ana", "2026-10-12", "2026-10-12");
    const drawer = await screen.findByRole("dialog");
    expect(within(drawer).getByText("Marcações do dia")).toBeInTheDocument();
    // Entrada no resumo do dia + a marcação "A trabalhar" às 09:20 (hora de Lisboa).
    await vi.waitFor(() => expect(within(drawer).getByRole("list")).toHaveTextContent("09:20A trabalhar"));
    expect(screen.getByRole("link", { name: "Ver assiduidade" })).toHaveAttribute("href", "/hr/novo/assiduidade?employeeId=e-ana");
    expect(screen.getByRole("link", { name: "Abrir ficha" })).toHaveAttribute("href", "/hr/novo/pessoas/e-ana");
  });
});
