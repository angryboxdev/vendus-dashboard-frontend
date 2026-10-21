import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Overview, PersonOverview } from "../../../domain/entities/overview.ts";
import type { Person } from "../../../domain/entities/people.ts";
import { fakeNovoRhModule } from "../../../fake-module.test-utils.ts";
import { NovoRhProvider, type NovoRhModule } from "../../../novo-rh.module.tsx";
import { PeopleListView } from "./PeopleListView.tsx";

const PERSON: Person = {
  id: "e1", firstName: "Carla", lastName: "Demo", fullName: "Carla Demo", nif: "123456789", email: null, phone: null, personalEmail: null,
  address: null, postalCode: null, city: null, country: null, birthDate: null, gender: null, nationality: null, niss: null, idCardNumber: null, iban: null,
  hireDate: "2026-01-05", primaryLocationId: "loc-1", positionId: "pos-op", status: "active", currency: "EUR", payPeriod: "monthly", baseSalary: null, hourlyRate: null,
  deactivatedAt: null, deactivationReason: null, userId: null, photoUrl: null, version: 1, hidden: [], missing: [], weeklyHours: 40,
};

const today = (employeeId: string, over: Partial<PersonOverview> = {}): PersonOverview => ({
  employeeId, name: employeeId, locationId: null, locationName: null, week: [], segments: [],
  date: "2026-10-18", status: "working", lateMinutes: 0, workedSeconds: 0, theoreticalSeconds: 0, plannedStart: null, plannedEnd: null, firstInAt: null, absenceType: null, ...over,
});

function setup(people: Person[], overviewPeople: PersonOverview[] | Error) {
  const m: NovoRhModule = fakeNovoRhModule({ settings: { listLocations: vi.fn(async () => [{ id: "loc-1", label: "Loja Porto" }]) } as unknown as NovoRhModule["settings"] });
  m.people.list = vi.fn(async () => people);
  m.people.listPositions = vi.fn(async () => [{ id: "pos-op", name: "Operador" }]);
  m.overview.today = vi.fn(async () => {
    if (overviewPeople instanceof Error) throw overviewPeople;
    return { people: overviewPeople } as unknown as Overview;
  });
  render(
    <MemoryRouter initialEntries={["/hr/novo/pessoas"]}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <NovoRhProvider module={m} modeStore={{ load: () => "real", save: () => {} }}>
          <Routes>
            <Route path="/hr/novo/pessoas" element={<PeopleListView />} />
          </Routes>
        </NovoRhProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
  return m;
}

const rowOf = async (name: string) => (await screen.findByRole("link", { name })).closest("tr")!;

describe("Lista de colaboradores — Horário e Horas hoje", () => {
  beforeEach(() => localStorage.clear());

  it("mostra horário de hoje, horas semanais do contrato e horas de hoje com barra (uma leitura da vista do dia)", async () => {
    const m = setup(
      [PERSON, { ...PERSON, id: "e2", fullName: "Rui Demo", weeklyHours: null }, { ...PERSON, id: "e3", fullName: "Eva Demo", weeklyHours: 37.5 }],
      [
        today("e1", { plannedStart: "09:00", plannedEnd: "17:00", theoreticalSeconds: 8 * 3600, workedSeconds: 4 * 3600 + 30 * 60 }),
        today("e2", { status: "day_off" }),
        today("e3", { status: "absent", absenceType: "Férias" }),
      ],
    );
    await rowOf("Carla Demo");
    // «Horas hoje» é opcional na lista premium: liga-se em «Colunas».
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Colunas" }));
    await user.click(screen.getByRole("checkbox", { name: "Horas hoje" }));
    const carla = await rowOf("Carla Demo");
    expect(screen.getByRole("columnheader", { name: "Horário hoje" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Horas hoje" })).toBeInTheDocument();
    expect(await within(carla).findByText("09:00–17:00")).toBeInTheDocument();
    expect(within(carla).getByText("40h semana")).toBeInTheDocument();
    expect(within(carla).getByText("4h 30min")).toBeInTheDocument();
    expect(within(carla).getByRole("progressbar")).toHaveAttribute("aria-valuenow", "56");
    const rui = await rowOf("Rui Demo");
    expect(within(rui).getByText("Folga")).toBeInTheDocument();
    expect(within(rui).queryByText(/semana/)).not.toBeInTheDocument();
    const eva = await rowOf("Eva Demo");
    expect(within(eva).getByText("Férias")).toBeInTheDocument();
    expect(within(eva).getByText("37,5h semana")).toBeInTheDocument();
    expect(m.overview.today).toHaveBeenCalledTimes(1);
  });

  it("sem dados de hoje (ou erro na vista do dia) mostra «—», nunca 0h", async () => {
    setup([PERSON], new Error("403"));
    const row = await rowOf("Carla Demo");
    await vi.waitFor(() => expect(within(row).getAllByText("—").length).toBeGreaterThanOrEqual(2));
    expect(within(row).queryByText("0h 00min")).not.toBeInTheDocument();
    expect(within(row).getByText("40h semana")).toBeInTheDocument();
  });

  it("«A completar» diz o que falta e leva à ficha", async () => {
    setup([{ ...PERSON, missing: ["nif", "hireDate"] }], []);
    const link = await screen.findByRole("link", { name: /A completar — Falta: NIF, Data de admissão/ });
    expect(link).toHaveAttribute("href", "/hr/novo/pessoas/e1");
  });

  it("ficha: aviso diz o que falta e «Completar dados» volta ao separador Dados", async () => {
    const m: NovoRhModule = fakeNovoRhModule({ settings: { listLocations: vi.fn(async () => []), listEmployees: vi.fn(async () => []) } as unknown as NovoRhModule["settings"] });
    m.people.get = vi.fn(async () => ({ person: { ...PERSON, missing: ["nif", "primaryLocationId"] }, etag: '"1"' }));
    m.people.list = vi.fn(async () => []);
    m.people.listPositions = vi.fn(async () => []);
    const { PersonView } = await import("./PersonView.tsx");
    const { default: userEvent } = await import("@testing-library/user-event");
    render(
      <MemoryRouter initialEntries={["/hr/novo/pessoas/e1"]}>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <NovoRhProvider module={m} modeStore={{ load: () => "real", save: () => {} }}>
            <Routes>
              <Route path="/hr/novo/pessoas/:id" element={<PersonView />} />
            </Routes>
          </NovoRhProvider>
        </QueryClientProvider>
      </MemoryRouter>,
    );
    expect(await screen.findByText("Falta: NIF, Centro principal")).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: "Contratos" }));
    await user.click(screen.getByRole("button", { name: "Completar dados" }));
    expect(screen.getByRole("tab", { name: "Dados" })).toHaveAttribute("aria-selected", "true");
  });

  it("filtros sem resultados: estado vazio com «Limpar filtros»", async () => {
    setup([{ ...PERSON }], []);
    await screen.findByRole("link", { name: "Carla Demo" });
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    await user.type(screen.getByRole("textbox", { name: "Pesquisar por nome" }), "zzz");
    await user.selectOptions(screen.getByRole("combobox", { name: "Centro" }), "none");
    expect(await screen.findByText("Nenhum colaborador com estes filtros.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Limpar filtros" }));
    expect(await screen.findByRole("link", { name: "Carla Demo" })).toBeInTheDocument();
  });
});
