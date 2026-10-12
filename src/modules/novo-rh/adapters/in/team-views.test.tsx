import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { AbsenceRequest } from "../../domain/entities/absences.ts";
import type { Overview, PersonOverview } from "../../domain/entities/overview.ts";
import { fakeNovoRhModule } from "../../fake-module.test-utils.ts";
import { NovoRhProvider, type NovoRhModule } from "../../novo-rh.module.tsx";
import { CalendarPanel } from "./absences/CalendarPanel.tsx";
import { IncidentsPanel } from "./attendance/IncidentsPanel.tsx";
import { TeamDayPanel } from "./attendance/TeamDayPanel.tsx";
import { TeamPlanPanel } from "./time/TeamPlanPanel.tsx";
import { TimeBankView } from "./time-bank/TimeBankView.tsx";

function renderWith(mod: NovoRhModule, ui: ReactNode) {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <NovoRhProvider module={mod} modeStore={{ load: () => "real", save: () => {} }}>
        <MemoryRouter>{ui}</MemoryRouter>
      </NovoRhProvider>
    </QueryClientProvider>,
  );
}

const person = (id: string, name: string, over: Partial<PersonOverview>): PersonOverview => ({
  date: "2026-10-12",
  status: "working",
  lateMinutes: 0,
  workedSeconds: 3600,
  theoreticalSeconds: 8 * 3600,
  plannedStart: "09:00",
  plannedEnd: "17:00",
  firstInAt: "2026-10-12T08:00:00Z",
  absenceType: null,
  employeeId: id,
  name,
  locationId: "l1",
  locationName: "Porto",
  week: [],
  segments: [{ start: "2026-10-12T08:00:00Z", end: "2026-10-12T09:00:00Z", type: "work" }],
  ...over,
});
const OVERVIEW: Overview = {
  date: "2026-10-12",
  today: "2026-10-12",
  timeZone: "Europe/Lisbon",
  generatedAt: "2026-10-12T09:00:00Z",
  kpis: { people: 3, scheduled: 3, working: 1, remote: 0, onBreak: 0, finished: 0, absent: 0, missing: 1, late: 1, notStarted: 1 },
  people: [
    person("e-rui", "Rui Demo", { status: "missing", firstInAt: null, workedSeconds: 0, segments: [] }),
    person("e-ana", "Ana Demo", { lateMinutes: 15 }),
    person("e-eva", "Eva Demo", { status: "not_started", firstInAt: null, workedSeconds: 0, segments: [] }),
  ],
  locations: [],
  week: [],
  pending: { absenceRequests: 0, corrections: 0, incidents: 0, customRequests: 0, alerts: 0 },
  holidays: [],
};

describe("Dia da equipa (FE-030)", () => {
  it("linha do tempo por pessoa e filtro 'só faltas e atrasos'", async () => {
    const mod = fakeNovoRhModule({ overview: { get: vi.fn(async () => OVERVIEW), plan: vi.fn() } });
    renderWith(mod, <TeamDayPanel />);
    expect(await screen.findByRole("img", { name: "Linha do tempo de Ana Demo" })).toBeInTheDocument();
    expect(screen.getByText("Eva Demo")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("checkbox", { name: "Só faltas e atrasos" }));
    expect(screen.queryByText("Eva Demo")).not.toBeInTheDocument();
    expect(screen.getByText("Rui Demo")).toBeInTheDocument();
    expect(screen.getByText("15 min atraso")).toBeInTheDocument();
  });
});

describe("Planeado da equipa (FE-031)", () => {
  it("grelha com horário, feriado, ausência e quem não tem planeamento", async () => {
    const plan = vi.fn(async (from: string, to: string) => ({
      from,
      to,
      people: [
        { employeeId: "e1", name: "Sem Plano", locationId: "l1", locationName: "Porto", unplanned: true, days: [{ date: from, plannedStart: null, plannedEnd: null, theoreticalSeconds: 0, absenceType: null, holiday: false }] },
        {
          employeeId: "e2",
          name: "Ana Demo",
          locationId: "l1",
          locationName: "Porto",
          unplanned: false,
          days: [
            { date: from, plannedStart: "09:00", plannedEnd: "17:00", theoreticalSeconds: 8 * 3600, absenceType: null, holiday: false },
            { date: plusOne(from), plannedStart: null, plannedEnd: null, theoreticalSeconds: 0, absenceType: "Férias", holiday: false },
          ],
        },
      ],
    }));
    const mod = fakeNovoRhModule({ overview: { get: vi.fn(), plan } });
    renderWith(mod, <TeamPlanPanel />);
    expect(await screen.findByText("09:00–17:00")).toBeInTheDocument();
    expect(screen.getByText("Férias")).toBeInTheDocument();
    expect(screen.getByText("1 sem planeamento")).toBeInTheDocument();
    const [from, to] = plan.mock.calls[0]!;
    expect(new Date(`${from}T00:00:00Z`).getUTCDay()).toBe(1);
    expect((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000).toBe(13);
  });
});
const plusOne = (d: string) => new Date(Date.parse(`${d}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);

describe("Banco de horas — todos (FE-034)", () => {
  it("lista ordenada por saldo e abre o histórico da pessoa", async () => {
    const mod = fakeNovoRhModule();
    mod.timeBank.balances = vi.fn(async () => [
      { employeeId: "e1", name: "Ana Demo", locationName: "Porto", balance: -3600, generated: -3600, compensatedRest: 0, compensatedPaid: 0, expired: 0 },
      { employeeId: "e2", name: "Rui Demo", locationName: "Braga", balance: 7200, generated: 7200, compensatedRest: 0, compensatedPaid: 0, expired: 0 },
    ]);
    mod.settings = { listEmployees: vi.fn(async () => [{ id: "e1", label: "Ana Demo" }]) } as unknown as NovoRhModule["settings"];
    mod.timeBank.ledger = vi.fn(() => new Promise<never>(() => {}));
    renderWith(mod, <TimeBankView />);
    const rows = await screen.findAllByRole("row");
    expect(rows[1]).toHaveTextContent("Rui Demo");
    expect(rows[1]).toHaveTextContent("+2h00m00s");
    expect(screen.getByText("Total: +1h00m00s")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Ana Demo" }));
    expect(mod.timeBank.ledger).toHaveBeenCalledWith("e1");
  });
});

describe("Calendário de ausências (FE-035)", () => {
  it("mostra aprovadas e pendentes no mês e atribui a vários com resultado por pessoa", async () => {
    const mod = fakeNovoRhModule();
    const month = new Date().toISOString().slice(0, 7);
    const req = (id: string, employeeId: string, status: AbsenceRequest["status"]): AbsenceRequest =>
      ({ id, employeeId, typeId: "t1", typeName: "Férias", typeColor: "#0ea5e9", private: false, kind: "absence", startDate: `${month}-10`, endDate: `${month}-11`, startTime: null, endTime: null, halfDay: false, amount: 2, unit: "days", period: `${month.slice(0, 4)}-01-01`, status, comment: null, requestedBy: "x", levels: [], currentLevel: 0, cancelReason: null, createdAt: `${month}-01T00:00:00Z` }) as AbsenceRequest;
    mod.absences.listRequests = vi.fn(async () => [req("r1", "e1", "approved"), req("r2", "e2", "pending"), req("r3", "e2", "rejected")]);
    mod.absences.listTypes = vi.fn(async () => [{ id: "t1", name: "Férias", archived: false, unit: "days" } as never]);
    mod.absences.assign = vi.fn(async (employeeId: string) => {
      if (employeeId === "e2") throw new Error("Saldo insuficiente.");
      return {} as never;
    });
    mod.settings = { listEmployees: vi.fn(async () => [{ id: "e1", label: "Ana Demo" }, { id: "e2", label: "Rui Demo" }]) } as unknown as NovoRhModule["settings"];
    renderWith(mod, <CalendarPanel />);
    expect(await screen.findByLabelText(`Ana Demo ${month}-10: Férias (Aprovada)`)).toBeInTheDocument();
    expect(screen.getByLabelText(`Rui Demo ${month}-11: Férias (Pendente)`)).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Atribuir a vários" }));
    const dialog = screen.getByRole("dialog");
    await user.selectOptions(within(dialog).getByLabelText("Tipo de ausência"), "t1");
    await user.click(within(dialog).getByRole("button", { name: "Selecionar todos" }));
    await user.click(within(dialog).getByRole("button", { name: "Atribuir a 2" }));
    expect(mod.absences.assign).toHaveBeenCalledTimes(2);
    expect(await within(dialog).findByText("1 atribuída(s), 1 recusada(s)")).toBeInTheDocument();
    expect(within(dialog).getByText(/Rui Demo: Saldo insuficiente/)).toBeInTheDocument();
  });
});

describe("Incidentes em lote (FE-033)", () => {
  it("seleciona os abertos e dispensa com comentário, um pedido por incidente", async () => {
    const mod = fakeNovoRhModule();
    const inc = (id: string, type: "late" | "missing_out") => ({ id, employeeId: "e1", workDate: "2026-10-08", type, source: "engine", status: "open" as const, comment: null, resolvedBy: null, resolvedAt: null });
    mod.attendance.incidents = vi.fn(async () => [inc("i1", "late"), inc("i2", "missing_out")]);
    mod.attendance.resolveIncident = vi.fn(async () => ({}) as never);
    mod.settings = { listEmployees: vi.fn(async () => [{ id: "e1", label: "Ana Demo" }]) } as unknown as NovoRhModule["settings"];
    renderWith(mod, <IncidentsPanel />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("checkbox", { name: "Selecionar todos os abertos" }));
    const bar = screen.getByRole("region", { name: "Resolver em lote" });
    expect(within(bar).getByRole("button", { name: "Dispensar" })).toBeDisabled();
    await user.type(within(bar).getByLabelText("Comentário"), "Turno trocado com colega");
    await user.click(within(bar).getByRole("button", { name: "Dispensar" }));
    expect(mod.attendance.resolveIncident).toHaveBeenCalledTimes(2);
    expect(mod.attendance.resolveIncident).toHaveBeenCalledWith("i1", "dismiss", "Turno trocado com colega");
  });
});
