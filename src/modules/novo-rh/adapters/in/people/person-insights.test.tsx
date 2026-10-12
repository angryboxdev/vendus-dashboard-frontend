import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { AttendanceDays } from "../../../domain/entities/attendance.ts";
import type { Person } from "../../../domain/entities/people.ts";
import { auditChangedFields, fieldHistory, monthStats } from "../../../domain/services/person-stats.service.ts";
import { fakeNovoRhModule } from "../../../fake-module.test-utils.ts";
import { NovoRhProvider, type NovoRhModule } from "../../../novo-rh.module.tsx";
import { PeopleListView } from "./PeopleListView.tsx";
import { PersonView } from "./PersonView.tsx";

const PERSON: Person = {
  id: "e1", firstName: "Carla", lastName: "Demo", fullName: "Carla Maria Demo", nif: "123456789", email: "carla@demo.invalid", phone: null, personalEmail: null,
  address: null, postalCode: null, city: null, country: null, birthDate: null, gender: null, nationality: null, niss: null, idCardNumber: null, iban: null,
  hireDate: "2026-01-05", primaryLocationId: "loc-1", positionId: "pos-op", status: "active", currency: "EUR", payPeriod: "monthly", baseSalary: null, hourlyRate: null,
  deactivatedAt: null, deactivationReason: null, userId: null, version: 3, hidden: [], missing: [],
};

const day = (workDate: string, over: Partial<AttendanceDays["days"][number]> = {}) => ({ workDate, workedSeconds: 8 * 3600, breakSeconds: 1800, nightSeconds: 0, theoreticalSeconds: 8 * 3600, excessSeconds: 0, pendingSeconds: 0, segments: [], incidents: [], ...over });
const ev = (id: string, occurredAt: string, segmentType: "work" | "off") => ({ id, employeeId: "e1", occurredAt, segmentType, source: "web", locationId: null });
const DAYS: AttendanceDays = {
  employeeId: "e1",
  timeZone: "Europe/Lisbon",
  days: [day("2026-10-01"), day("2026-10-02", { incidents: ["late"] }), day("2026-10-05", { workedSeconds: 0, breakSeconds: 0, incidents: ["missing_in"] })],
  totals: { workedSeconds: 0, theoreticalSeconds: 0, excessSeconds: 0, pendingSeconds: 0, nightSeconds: 0 },
  events: [ev("a", "2026-10-01T08:00:00Z", "work"), ev("b", "2026-10-01T16:30:00Z", "off"), ev("c", "2026-10-02T08:30:00Z", "work"), ev("d", "2026-10-02T17:00:00Z", "off")],
  revisions: [],
  incidents: [],
  refusable: [],
};

function renderAt(path: string, ui: ReactNode, mod: NovoRhModule) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <NovoRhProvider module={mod} modeStore={{ load: () => "real", save: () => {} }}>
          <Routes>
            <Route path="/hr/novo/pessoas" element={ui} />
            <Route path="/hr/novo/pessoas/:id" element={ui} />
          </Routes>
        </NovoRhProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

function mod() {
  const m = fakeNovoRhModule({ settings: { listLocations: vi.fn(async () => [{ id: "loc-1", label: "Loja Porto" }, { id: "loc-2", label: "Loja Braga" }]), listEmployees: vi.fn(async () => []), listDefinitions: vi.fn(async () => []), effective: vi.fn(async () => []) } as unknown as NovoRhModule["settings"] });
  m.people.listPositions = vi.fn(async () => [{ id: "pos-op", name: "Operador" }]);
  m.people.get = vi.fn(async () => ({ person: PERSON, etag: '"3"' }));
  m.people.list = vi.fn(async () => []);
  return m;
}

describe("Ficha do colaborador (FE-014, FE-023)", () => {
  it("estatísticas do mês: faltas, atrasos, entrada e saída médias (hora de Lisboa)", () => {
    const s = monthStats(DAYS);
    expect(s).toMatchObject({ workedDays: 2, scheduledDays: 3, missing: 1, late: 1, avgIn: "09:15", avgOut: "17:45" });
    expect(s.worked).toBe(16 * 3600);
  });

  it("histórico mostra só os nomes dos campos alterados", () => {
    expect(auditChangedFields({ email: "a", phone: "1", version: 1 }, { email: "b", phone: "1", version: 2 })).toEqual(["email"]);
    expect(auditChangedFields(null, { status: "inactive" })).toEqual(["status"]);
  });

  it("cabeçalho com iniciais, cargo, local e admissão; separadores Estatísticas e Histórico", async () => {
    const m = mod();
    m.attendance.days = vi.fn(async () => DAYS);
    m.audit.list = vi.fn(async () => [{ id: "a1", seq: 1, occurredAt: "2026-10-03T10:00:00Z", actor: "rh@demo.invalid", action: "people.employee.update", resourceType: "employee", resourceId: "e1", before: { email: "x" }, after: { email: "y" }, reason: "Pedido da colaboradora", ip: null, userAgent: null }] as never);
    renderAt("/hr/novo/pessoas/e1", <PersonView />, m);
    expect(await screen.findByText("Operador · Loja Porto · desde 2026-01-05")).toBeInTheDocument();
    expect(screen.getByText("CD")).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: "Estatísticas" }));
    expect(await screen.findByText("2 de 3")).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Histórico" }));
    expect(await screen.findByText("Campos: email")).toBeInTheDocument();
    expect(m.audit.list).toHaveBeenCalledWith({ resourceId: "e1" });
    await user.click(screen.getByRole("tab", { name: "Ponto" }));
    expect(screen.queryByRole("combobox", { name: "Colaborador" })).not.toBeInTheDocument();
  });
});

describe("Lista de colaboradores (FE-011)", () => {
  it("números de topo filtram; local filtra; colunas à escolha", async () => {
    const m = mod();
    m.people.list = vi.fn(async () => [
      PERSON,
      { ...PERSON, id: "e2", fullName: "Rui Demo", primaryLocationId: null, missing: ["nif"] },
      { ...PERSON, id: "e3", fullName: "Eva Demo", primaryLocationId: "loc-2" },
    ]);
    renderAt("/hr/novo/pessoas", <PeopleListView />, m);
    await screen.findByRole("link", { name: "Rui Demo" });
    const user = userEvent.setup();
    const kpis = screen.getByRole("group", { name: "Resumo da lista" });
    await user.click(within(kpis).getByRole("button", { name: /Ficha a completar\s*1/ }));
    expect(screen.queryByRole("link", { name: "Carla Maria Demo" })).not.toBeInTheDocument();
    expect(screen.getByText("1 de 3")).toBeInTheDocument();
    await user.click(within(kpis).getByRole("button", { name: /Colaboradores\s*3/ }));
    await user.selectOptions(screen.getByRole("combobox", { name: "Centro" }), "loc-2");
    expect(screen.getByRole("link", { name: "Eva Demo" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Rui Demo" })).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "E-mail" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Colunas" }));
    await user.click(screen.getByRole("checkbox", { name: "E-mail" }));
    expect(screen.getByRole("columnheader", { name: "E-mail" })).toBeInTheDocument();
  });
});

describe("Assistente de criação, acesso e históricos (FE-012, FE-015, FE-016, FE-018)", () => {
  it("histórico de um campo a partir da auditoria (camelCase ou snake_case), mais recente primeiro", () => {
    const ev = (id: string, at: string, before: unknown, after: unknown) => ({ id, occurredAt: at, actor: "rh@demo.invalid", reason: null, before, after });
    const h = fieldHistory([ev("1", "2026-01-01T10:00:00Z", { base_salary: 900 }, { base_salary: 950 }), ev("2", "2026-06-01T10:00:00Z", { baseSalary: 950 }, { baseSalary: 1000 }), ev("3", "2026-07-01T10:00:00Z", { email: "a" }, { email: "b" })], "baseSalary");
    expect(h.map((x) => [x.from, x.to])).toEqual([
      [950, 1000],
      [900, 950],
    ]);
  });

  it("assistente: passos, aviso de ficha parecida e cria ficha + contrato + horário", async () => {
    const m = mod();
    m.people.list = vi.fn(async () => [{ ...PERSON, id: "e9", fullName: "Rui Demo", nif: "999999990" }]);
    m.people.create = vi.fn(async () => ({ ...PERSON, id: "new1" }));
    m.people.createContract = vi.fn(async () => ({}) as never);
    m.time.listSchedules = vi.fn(async () => [{ id: "s1", name: "Manhã", kind: "fixed" as const, archived: false, versions: [] }]);
    m.time.assign = vi.fn(async () => ({}) as never);
    renderAt("/hr/novo/pessoas", <PeopleListView />, m);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Novo colaborador" }));
    const dialog = screen.getByRole("dialog");
    await user.type(within(dialog).getByLabelText(/^Nome/), "Rui");
    await user.type(within(dialog).getByLabelText(/^Apelido/), "Demo");
    await user.type(within(dialog).getByLabelText(/^NIF/), "999999990");
    expect(await within(dialog).findByText("Já existe uma ficha parecida")).toBeInTheDocument();
    await user.clear(within(dialog).getByLabelText(/^NIF/));
    await user.type(within(dialog).getByLabelText(/^NIF/), "123123123");
    await user.clear(within(dialog).getByLabelText(/^Nome/));
    await user.type(within(dialog).getByLabelText(/^Nome/), "Ana");
    await user.click(within(dialog).getByRole("button", { name: "Seguinte" }));
    expect(within(dialog).getByRole("button", { name: "Seguinte" })).toBeDisabled();
    await user.type(within(dialog).getByLabelText(/^Data de admissão|^Admissão/), "2026-11-02");
    await user.selectOptions(within(dialog).getByLabelText(/^Centro|^Local/), "loc-1");
    await user.click(within(dialog).getByRole("button", { name: "Seguinte" }));
    await user.selectOptions(await within(dialog).findByLabelText("Horário"), "s1");
    await user.click(within(dialog).getByRole("button", { name: "Seguinte" }));
    expect(within(dialog).getByText("Ana Demo")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Criar colaborador" }));
    await vi.waitFor(() => expect(m.time.assign).toHaveBeenCalled());
    expect(m.people.create).toHaveBeenCalledWith(expect.objectContaining({ firstName: "Ana", lastName: "Demo", nif: "123123123", hireDate: "2026-11-02", primaryLocationId: "loc-1" }));
    expect(m.people.createContract).toHaveBeenCalledWith("new1", expect.objectContaining({ contractType: "permanent", startDate: "2026-11-02", weeklyHours: 40 }));
    expect(m.time.assign).toHaveBeenCalledWith({ resourceType: "schedule", resourceId: "s1", targetType: "employee", targetId: "new1", validFrom: "2026-11-02", validTo: null });
  });

  it("acesso: sem conta mostra onde criar; com conta mostra perfil e âmbitos", async () => {
    const m = mod();
    m.people.get = vi.fn(async () => ({ person: { ...PERSON, userId: "u1" }, etag: '"3"' }));
    m.access.listUsers = vi.fn(async () => [{ userId: "u1", label: "Carla (carla@demo.invalid)", profileId: "p1" }]);
    m.access.listProfiles = vi.fn(async () => [{ id: "p1", name: "Gestor de loja", systemKey: null }]);
    m.access.listScopes = vi.fn(async () => [{ id: "sc1", userId: "u1", scopeType: "location" as const, scopeId: "loc-1", validFrom: "2026-01-01", validTo: null }]);
    renderAt("/hr/novo/pessoas/e1", <PersonView />, m);
    await userEvent.click(await screen.findByRole("tab", { name: "Acesso" }));
    expect(await screen.findByText("Gestor de loja")).toBeInTheDocument();
    expect(screen.getByText("Centro · 2026-01-01")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Editar utilizador →" })).toHaveAttribute("href", "/admin/users/u1");
  });
});
