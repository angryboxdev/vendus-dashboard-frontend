import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { dayMinutes, formatMinutes, versionDaysFromDraft, weeklyMinutes, emptyDraft } from "../../../domain/services/time-format.service.ts";
import { fakeNovoRhModule } from "../../../fake-module.test-utils.ts";
import { NovoRhProvider, type NovoRhModule } from "../../../novo-rh.module.tsx";
import { HolidaysPanel } from "./HolidaysPanel.tsx";
import { SchedulesPanel } from "./SchedulesPanel.tsx";

function renderWith(m: NovoRhModule, view: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <NovoRhProvider module={m}>
        {view}
      </NovoRhProvider>
    </QueryClientProvider>,
  );
}

const mod = () =>
  fakeNovoRhModule({ settings: { listLocations: vi.fn(async () => [{ id: "loc-1", label: "Loja Porto" }]), listEmployees: vi.fn(async () => []) } as unknown as NovoRhModule["settings"] });

describe("Tempo — editor de horários", () => {
  it("converte o texto por dia em faixas/minutos e recusa formatos inválidos", () => {
    const fixed = versionDaysFromDraft("fixed", { ...emptyDraft(), "1": "09:00-13:00, 14:00-18:00" });
    expect(fixed).toEqual({ "1": [{ start: "09:00", end: "13:00" }, { start: "14:00", end: "18:00" }] });
    expect(versionDaysFromDraft("fixed", { ...emptyDraft(), "1": "9h-13h" })).toBeNull();
    expect(versionDaysFromDraft("flexible", { ...emptyDraft(), "5": "7,5" })).toEqual({ "5": 450 });
    expect(weeklyMinutes("fixed", { days: fixed!, night: false })).toBe(480);
    expect(dayMinutes("fixed", { days: { "5": [{ start: "22:00", end: "06:00" }] }, night: true }, "5")).toBe(480);
    expect(formatMinutes(450)).toBe("07h30");
  });

  it("criar horário envia a primeira versão com os dias", async () => {
    const m = mod();
    m.time.createSchedule = vi.fn(async () => ({ id: "s1", name: "Loja", kind: "fixed" as const, archived: false, versions: [] }));
    renderWith(m, <SchedulesPanel />);
    const user = userEvent.setup();
    const box = screen.getByRole("region", { name: "Novo horário" });
    await user.type(within(box).getByLabelText("Nome"), "Loja");
    await user.click(within(box).getByRole("button", { name: "Adicionar" }));
    expect(m.time.createSchedule).toHaveBeenCalledWith(expect.objectContaining({ name: "Loja", kind: "fixed", version: expect.objectContaining({ days: expect.objectContaining({ "1": [{ start: "09:00", end: "13:00" }, { start: "14:00", end: "18:00" }] }) }) }));
  });
});

describe("Tempo — feriados", () => {
  const CAL = {
    id: "hc1", name: "Porto", country: "PT", compensationCoefficient: 1, approvalRequired: false, accruedExpires: false, halfDayCompensation: false,
    days: [{ id: "d1", calendarId: "hc1", date: "2026-12-25", name: "Natal", kind: "national" as const, status: "to_confirm" as const, coefficient: null, source: "Importação" }],
  };

  it("feriado importado aparece 'A confirmar' e confirma-se", async () => {
    const m = mod();
    m.time.listHolidayCalendars = vi.fn(async () => [CAL]);
    m.time.updateHoliday = vi.fn(async () => ({ ...CAL.days[0]!, status: "confirmed" as const }));
    renderWith(m, <HolidaysPanel />);
    const user = userEvent.setup();
    const card = await screen.findByRole("region", { name: "Porto" });
    expect(within(card).getByText("A confirmar")).toBeInTheDocument();
    await user.click(within(card).getByRole("button", { name: "Confirmar Natal" }));
    expect(m.time.updateHoliday).toHaveBeenCalledWith("d1", { status: "confirmed" });
  });

  it("RE_35_eliminar_mostra_o_impacto_e_so_avanca_com_o_nome_escrito", async () => {
    const m = mod();
    m.time.listHolidayCalendars = vi.fn(async () => [CAL]);
    m.time.deletePreview = vi.fn(async () => ({ name: "Porto", days: 13, employees: 6, assignments: 1 }));
    m.time.deleteCalendar = vi.fn(async () => ({ name: "Porto", days: 13, employees: 6, assignments: 1 }));
    renderWith(m, <HolidaysPanel />);
    const user = userEvent.setup();
    const card = await screen.findByRole("region", { name: "Porto" });
    await user.click(within(card).getByRole("button", { name: "Eliminar calendário" }));
    expect(await within(card).findByText(/13 dia\(s\) e 6 colaborador\(es\) afetados/)).toBeInTheDocument();
    const confirm = within(card).getAllByRole("button", { name: "Eliminar calendário" }).at(-1)!;
    expect(confirm).toBeDisabled();
    await user.type(within(card).getByLabelText("Escreva o nome do calendário para confirmar"), "Porto");
    await user.click(confirm);
    expect(m.time.deleteCalendar).toHaveBeenCalledWith("holiday", "hc1", "Porto");
  });
});
