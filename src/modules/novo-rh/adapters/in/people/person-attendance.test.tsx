import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { AttendanceDays } from "../../../domain/entities/attendance.ts";
import { monthStats, statsNotes } from "../../../domain/services/person-stats.service.ts";
import { fakeNovoRhModule } from "../../../fake-module.test-utils.ts";
import { NovoRhProvider, type NovoRhModule } from "../../../novo-rh.module.tsx";
import { DaysPanel } from "../attendance/DaysPanel.tsx";
import { PersonStatsTab } from "./PersonInsightTabs.tsx";

type Day = AttendanceDays["days"][number];
const day = (workDate: string, over: Partial<Day> = {}): Day => ({ workDate, workedSeconds: 0, breakSeconds: 0, nightSeconds: 0, theoreticalSeconds: 0, excessSeconds: 0, pendingSeconds: 0, segments: [], incidents: [], ...over });
const seg = (start: string, end: string, type: "work" | "break_unpaid", flags: { open?: boolean; autoClosed?: boolean } = {}) => ({ start, end, type, open: !!flags.open, autoClosed: !!flags.autoClosed });
const data = (days: Day[]): AttendanceDays => ({ employeeId: "e1", timeZone: "Europe/Lisbon", days, totals: { workedSeconds: 0, theoreticalSeconds: 0, excessSeconds: 0, pendingSeconds: 0, nightSeconds: 0 }, events: [], revisions: [], incidents: [], refusable: [] });

// Caso real da task: trabalho sem previsto e uma pausa esquecida de horas.
const SUSPICIOUS = data([
  day("2026-10-01", { workedSeconds: 8 * 3600, breakSeconds: 1800, segments: [seg("2026-10-01T08:00:00Z", "2026-10-01T16:00:00Z", "work")] }),
  day("2026-10-02", { workedSeconds: 4 * 3600, breakSeconds: 10 * 3600, segments: [seg("2026-10-02T08:00:00Z", "2026-10-02T12:00:00Z", "work"), seg("2026-10-02T12:00:00Z", "2026-10-02T22:00:00Z", "break_unpaid", { autoClosed: true })] }),
]);

function renderWith(ui: ReactNode, m: NovoRhModule) {
  render(
    <MemoryRouter>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <NovoRhProvider module={m} modeStore={{ load: () => "real", save: () => {} }}>
          {ui}
        </NovoRhProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

function mod(days: AttendanceDays) {
  const m = fakeNovoRhModule({ settings: { listEmployees: vi.fn(async () => []) } as unknown as NovoRhModule["settings"] });
  m.attendance.days = vi.fn(async () => days);
  m.attendance.adjustments = vi.fn(async () => []);
  m.absences.listRequests = vi.fn(async () => []);
  return m;
}

describe("Estatísticas — notas para números suspeitos (sem mudar fórmulas)", () => {
  it("statsNotes: sem previsto no período e dias com pausa em curso/fechada automaticamente", () => {
    expect(statsNotes(SUSPICIOUS)).toEqual({ noSchedule: true, openBreakDays: 1 });
    // Os números continuam os do motor: nada é mascarado.
    expect(monthStats(SUSPICIOUS)).toMatchObject({ theoretical: 0, scheduledDays: 0, workedDays: 2, avgBreak: (1800 + 36000) / 2 });
    expect(statsNotes(data([day("2026-10-01", { workedSeconds: 3600, theoreticalSeconds: 3600 })]))).toEqual({ noSchedule: false, openBreakDays: 0 });
  });

  it("separador Estatísticas mostra as notas por baixo dos cartões", async () => {
    renderWith(<PersonStatsTab personId="e1" />, mod(SUSPICIOUS));
    const notes = await screen.findByRole("list", { name: "Notas sobre estes números" });
    expect(within(notes).getByText(/Sem horário atribuído nem turnos publicados/)).toBeInTheDocument();
    expect(within(notes).getByText(/1 dia\(s\) com pausa em curso ou fechada automaticamente/)).toBeInTheDocument();
  });
});

describe("Ponto — linha do dia", () => {
  it("uma faixa por dia com marcações, legenda, «—» sem marcações e faixa grande no detalhe", async () => {
    const m = mod(data([...SUSPICIOUS.days, day("2026-10-03")]));
    renderWith(<DaysPanel fixedEmployeeId="e1" />, m);
    expect(await screen.findByRole("columnheader", { name: "Linha do dia" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Linha do dia 2026-10-01" })).toBeInTheDocument();
    const fechada = screen.getByRole("img", { name: "Linha do dia 2026-10-02" });
    expect(fechada.querySelector('[data-segment="break_unpaid"]')).toHaveAttribute("title", "Em pausa · fechada automaticamente");
    expect(screen.getByText("Em curso ou fechada automaticamente")).toBeInTheDocument();
    const row3 = screen.getByRole("button", { name: "2026-10-03" }).closest("tr")!;
    expect((row3 as HTMLTableRowElement).cells[1]!.textContent).toBe("—");
    expect(within(row3).queryByRole("img")).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "2026-10-01" }));
    expect(screen.getAllByRole("img", { name: "Linha do dia 2026-10-01" })).toHaveLength(2);
  });
});
