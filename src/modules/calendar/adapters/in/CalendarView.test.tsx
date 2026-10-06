import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { CalendarUseCases } from "../../application/use-cases/calendar.use-cases.ts";
import type { CalendarItem, EventInput, HolidayImportRow, HolidayInput } from "../../domain/entities/calendar-item.ts";
import type { CalendarApiPort } from "../../domain/ports/out/calendar-api.port.ts";
import { CalendarProvider } from "../../calendar.module.tsx";
import { CalendarView } from "./CalendarView.tsx";

/** Objetos estáveis entre renders (ver nota no teste de LocationsAdminView). */
const auth = vi.hoisted(() => ({
  value: { user: { id: "u1", email: "admin@exemplo.pt", role: "admin" as "admin" | "manager" | "hr_viewer", organizationId: "org" }, loading: false },
}));
vi.mock("../../../../contexts/AuthContext.tsx", () => ({ useAuth: () => auth.value }));
const locationsState = vi.hoisted(() => ({ locations: [] as { id: string; name: string; isActive: boolean }[] }));
vi.mock("../../../locations/adapters/in/use-locations.ts", () => ({ useLocations: () => locationsState }));

function setRole(role: "admin" | "manager" | "hr_viewer") {
  auth.value = { ...auth.value, user: { ...auth.value.user, role } };
}

const TODAY = new Date().toISOString().slice(0, 10);
const YEAR = Number(TODAY.slice(0, 4)) + 1;

/** API falsa: feriados nacionais fictícios do ano seguinte, importação idempotente. */
class FakeCalendarApi implements CalendarApiPort {
  items: CalendarItem[] = [];
  private seq = 0;
  private readonly national: Omit<HolidayImportRow, "status">[] = [
    { date: `${YEAR}-01-01`, name: "Ano Novo" },
    { date: `${YEAR}-12-25`, name: "Natal" },
  ];
  async list(from: string, to: string) {
    return this.items.filter((i) => i.date >= from && i.date <= to);
  }
  async upcoming() {
    return this.items.filter((i) => i.date >= TODAY && (i.kind !== "event" || i.priority !== "normal"));
  }
  async createHoliday(input: HolidayInput) {
    this.items.push({ key: `holiday:${++this.seq}`, id: String(this.seq), kind: "holiday", date: input.date, title: input.name, locationId: input.locationId, priority: null, allDay: true, startTime: null, endTime: null, holidayType: input.type });
  }
  async updateHoliday() {}
  async deleteHoliday() {}
  async previewHolidayImport() {
    return this.national.map((h) => ({ ...h, status: this.items.some((i) => i.kind === "holiday" && i.date === h.date) ? ("existing" as const) : ("new" as const) }));
  }
  async importHolidays() {
    let created = 0;
    for (const h of await this.previewHolidayImport()) {
      if (h.status === "new") {
        await this.createHoliday({ date: h.date, name: h.name, type: "national", locationId: null });
        created += 1;
      }
    }
    return { created, skipped: this.national.length - created };
  }
  async createEvent(input: EventInput) {
    this.items.push({ key: `event:${++this.seq}`, id: String(this.seq), kind: "event", ...input, priority: input.priority });
  }
  async updateEvent() {}
  async cancelEvent() {}
}

function renderView(api = new FakeCalendarApi()) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <CalendarProvider module={{ calendar: new CalendarUseCases(api) }}>
          <CalendarView />
        </CalendarProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return api;
}

describe("CalendarView", () => {
  it("importar feriados mostra a pré-visualização e, repetido, não duplica", async () => {
    setRole("admin");
    const api = renderView();
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Importar feriados" }));
    let dialog = screen.getByRole("dialog", { name: "Importar feriados" });
    await user.click(within(dialog).getByRole("button", { name: "Pré-visualizar" }));
    expect(await within(dialog).findAllByText("Novo")).toHaveLength(2);
    await user.click(within(dialog).getByRole("button", { name: "Importar 2 novo(s)" }));
    expect(await within(dialog).findByText(/2 feriado\(s\) importado\(s\)/)).toBeInTheDocument();
    expect(await within(dialog).findAllByText("Já existe")).toHaveLength(2);
    expect(within(dialog).getByRole("button", { name: "Importar 0 novo(s)" })).toBeDisabled();

    await user.click(within(dialog).getByRole("button", { name: "Fechar" }));
    expect(api.items.filter((i) => i.kind === "holiday")).toHaveLength(2);
    dialog = screen.queryByRole("dialog", { name: "Importar feriados" }) as HTMLElement;
    expect(dialog).toBeNull();
  });

  it("gestor cria um evento crítico, que aparece nos próximos importantes", async () => {
    setRole("manager");
    renderView();
    const user = userEvent.setup();

    expect(screen.queryByRole("button", { name: "Novo feriado" })).not.toBeInTheDocument();
    await user.click(await screen.findByRole("button", { name: "Novo evento" }));
    const dialog = screen.getByRole("dialog", { name: "Novo evento" });
    await user.type(within(dialog).getByLabelText(/Título/), "Renovação seguro");
    await user.selectOptions(within(dialog).getByLabelText("Prioridade"), "critical");
    await user.click(within(dialog).getByRole("button", { name: "Criar evento" }));

    const aside = await screen.findByRole("heading", { name: "Próximos eventos importantes" });
    expect(await within(aside.parentElement!).findByText("Renovação seguro")).toBeInTheDocument();
  });

  it("perfil só-leitura não vê ações de gestão", async () => {
    setRole("hr_viewer");
    renderView();
    expect(await screen.findByRole("heading", { name: "Próximos eventos importantes" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Novo evento" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Importar feriados" })).not.toBeInTheDocument();
  });
});
