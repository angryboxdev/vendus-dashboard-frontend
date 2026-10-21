import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { AbsenceRequest, Balance } from "../../../domain/entities/absences.ts";
import type { Person } from "../../../domain/entities/people.ts";
import { todayIn } from "../../../domain/services/settings-format.service.ts";
import { fakeNovoRhModule } from "../../../fake-module.test-utils.ts";
import { NovoRhProvider, type NovoRhModule } from "../../../novo-rh.module.tsx";
import { PersonView } from "./PersonView.tsx";

// Dados fictícios (RGPD).
const PERSON: Person = {
  id: "e1", firstName: "Carla", lastName: "Demo", fullName: "Carla Demo", nif: "123456789", email: "carla@demo.invalid", phone: null, personalEmail: null,
  address: null, postalCode: null, city: null, country: null, birthDate: null, gender: null, nationality: null, niss: null, idCardNumber: null, iban: null,
  hireDate: "2026-01-05", primaryLocationId: "loc-1", positionId: null, status: "active", currency: "EUR", payPeriod: "monthly", baseSalary: null, hourlyRate: null,
  deactivatedAt: null, deactivationReason: null, userId: null, photoUrl: null, version: 3, hidden: [], missing: [],
};
const YEAR = todayIn().slice(0, 4);

function setup(over: (m: NovoRhModule) => void = () => {}) {
  const m = fakeNovoRhModule({ settings: { listLocations: vi.fn(async () => [{ id: "loc-1", label: "Loja Porto" }]), listEmployees: vi.fn(async () => []) } as unknown as NovoRhModule["settings"] });
  m.people.get = vi.fn(async () => ({ person: PERSON, etag: '"3"' }));
  m.people.listPositions = vi.fn(async () => []);
  over(m);
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
  return m;
}

describe("Ficha do colaborador — redesign premium", () => {
  it("Dados: menu de secções e o rascunho sobrevive à troca de separador", async () => {
    setup();
    const user = userEvent.setup();
    const nav = await screen.findByRole("navigation", { name: "Secções dos dados" });
    expect(within(nav).getAllByRole("button").map((b) => b.textContent)).toEqual(["Identificação", "Contactos", "Morada", "Trabalho", "Pagamento"]);
    await user.click(within(nav).getByRole("button", { name: "Morada" }));
    expect(within(nav).getByRole("button", { name: "Morada" })).toHaveAttribute("aria-current", "true");
    await user.type(screen.getByLabelText("Localidade"), "Porto");
    expect(screen.getByText("Tem alterações por guardar.")).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Contratos" }));
    expect(screen.getByLabelText("Alterações nos Dados por guardar")).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: /^Dados/ }));
    expect(screen.getByLabelText("Localidade")).toHaveValue("Porto");
    await user.click(screen.getByRole("button", { name: "Descartar" }));
    expect(screen.getByLabelText("Localidade")).toHaveValue("");
  });

  it("Ausências e férias: saldos em cartões e calendário com aprovadas e pendentes", async () => {
    const balance: Balance = { typeId: "t1", typeName: "Férias", unit: "days", limited: true, period: YEAR, accrued: 22, used: 7, adjusted: 0, balance: 15, pending: 2, available: 13, entries: [] };
    const req = (over: Partial<AbsenceRequest>): AbsenceRequest => ({
      id: "r1", employeeId: "e1", typeId: "t1", typeName: "Férias", typeColor: "#2563EB", private: false, kind: "absence", startDate: `${YEAR}-03-02`, endDate: `${YEAR}-03-03`,
      startTime: null, endTime: null, halfDay: false, amount: 2, unit: "days", period: YEAR, status: "approved", comment: null, requestedBy: "u1", levels: [], currentLevel: 0, cancelReason: null, createdAt: `${YEAR}-02-01T00:00:00Z`,
      ...over,
    });
    setup((m) => {
      m.absences.balances = vi.fn(async () => [balance]);
      m.absences.listRequests = vi.fn(async () => [req({}), req({ id: "r2", status: "pending", startDate: `${YEAR}-08-10`, endDate: `${YEAR}-08-10` })]);
    });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("tab", { name: "Ausências e férias" }));
    const card = (await screen.findByText("Disponíveis")).closest("li")!;
    expect(within(card).getByText("13 dias")).toBeInTheDocument();
    expect(within(card).getByText("22 dias")).toBeInTheDocument();
    expect(await screen.findByLabelText("02/03: Férias (Aprovada)")).toBeInTheDocument();
    expect(screen.getByLabelText("10/08: Férias (Pendente)")).toBeInTheDocument();
  });

  it("Estatísticas: muda de período e pede os dias desse intervalo", async () => {
    const m = setup((m) => {
      m.attendance.days = vi.fn(async () => ({ employeeId: "e1", timeZone: "Europe/Lisbon", days: [], totals: { workedSeconds: 0, theoreticalSeconds: 0, excessSeconds: 0, pendingSeconds: 0, nightSeconds: 0 }, events: [], revisions: [], incidents: [], refusable: [] }));
    });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("tab", { name: "Estatísticas" }));
    expect(await screen.findByText("Tempo programado")).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "Este ano" }));
    expect(m.attendance.days).toHaveBeenLastCalledWith("e1", `${YEAR}-01-01`, todayIn());
  });
});
