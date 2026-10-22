import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Person } from "../../../domain/entities/people.ts";
import { fakeNovoRhModule } from "../../../fake-module.test-utils.ts";
import { NovoRhProvider, type NovoRhModule } from "../../../novo-rh.module.tsx";
import { TeamAnalyticsView } from "./TeamAnalyticsView.tsx";

// Dados fictícios (RGPD).
const base = {
  firstName: "", lastName: "", nif: null, email: null, phone: null, personalEmail: null, address: null, postalCode: null, city: null, country: null, niss: null, idCardNumber: null, iban: null,
  positionId: null, currency: "EUR", payPeriod: "monthly", baseSalary: null, hourlyRate: null, deactivationReason: null, userId: null, photoUrl: null, version: 1, missing: [],
};
const person = (id: string, over: Partial<Person>): Person =>
  ({ ...base, id, fullName: `Pessoa ${id}`, hireDate: "2024-01-01", deactivatedAt: null, status: "active", birthDate: "1990-01-01", gender: "Feminino", nationality: "Portugal", primaryLocationId: "l1", hidden: [], ...over }) as Person;

describe("Mais → Relatórios → Análise da equipa", () => {
  it("efetivo, género e nacionalidade; campos escondidos contam como Desconhecido; comparar abre dois painéis", async () => {
    const m = fakeNovoRhModule({ settings: { listLocations: vi.fn(async () => [{ id: "l1", label: "Loja Porto" }, { id: "l2", label: "Loja Braga" }]), listEmployees: vi.fn(async () => []) } as unknown as NovoRhModule["settings"] });
    m.people.list = vi.fn(async () => [
      person("a", {}),
      person("b", { gender: "Masculino", nationality: "Brasil", primaryLocationId: "l2" }),
      person("c", { gender: null, birthDate: null, hidden: ["gender", "birthDate"] }),
      person("d", { status: "inactive", deactivatedAt: "2020-01-01T00:00:00Z" }),
    ]);
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <NovoRhProvider module={m} modeStore={{ load: () => "real", save: () => {} }}>
          <TeamAnalyticsView />
        </NovoRhProvider>
      </QueryClientProvider>,
    );
    const team = await screen.findByRole("region", { name: "Colaboradores" });
    expect(within(team).getByText("3")).toBeInTheDocument();
    expect(screen.getByText(/contam como «Desconhecido»/)).toBeInTheDocument();
    const gender = screen.getByRole("region", { name: "Género" });
    expect(within(gender).getByRole("img", { name: /Feminino 1, Masculino 1, Desconhecido 1/ })).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Colaboradores por nacionalidade" })).getByText("Brasil")).toBeInTheDocument();
    const user = userEvent.setup();
    await user.selectOptions(screen.getByRole("combobox", { name: "Âmbito" }), "location");
    await user.selectOptions(screen.getByRole("combobox", { name: "Centro" }), "l2");
    expect(within(screen.getByRole("region", { name: "Colaboradores" })).getByText("1")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Comparar" }));
    expect(screen.getAllByRole("region", { name: "Colaboradores" })).toHaveLength(2);
  });
});
