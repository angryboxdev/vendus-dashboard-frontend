import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { Person } from "../../../domain/entities/people.ts";
import { todayIn } from "../../../domain/services/settings-format.service.ts";
import { fakeNovoRhModule } from "../../../fake-module.test-utils.ts";
import { NovoRhProvider, type NovoRhModule } from "../../../novo-rh.module.tsx";
import { OrgChartView } from "./OrgChartView.tsx";

// Dados fictícios (RGPD).
const person = (id: string, fullName: string) => ({ id, fullName, positionId: null, primaryLocationId: "l1", photoUrl: null, status: "active", hidden: [] }) as unknown as Person;

describe("Mais → Organograma", () => {
  it("árvore por chefia, pesquisa, recolher e mudar a chefia pelo menu do cartão", async () => {
    const m = fakeNovoRhModule({ settings: { listLocations: vi.fn(async () => [{ id: "l1", label: "Loja Porto" }]), listEmployees: vi.fn(async () => []) } as unknown as NovoRhModule["settings"] });
    m.people.list = vi.fn(async () => [person("ceo", "Carla Teste"), person("a", "Ana Teste"), person("b", "Bia Teste")]);
    m.people.listPositions = vi.fn(async () => []);
    m.people.orgChart = vi.fn(async () => [
      { employeeId: "a", managerEmployeeId: "ceo", linkId: "1", validFrom: "2026-01-01" },
      { employeeId: "b", managerEmployeeId: "ceo", linkId: "2", validFrom: "2026-01-01" },
    ]);
    m.people.setDirectManager = vi.fn(async () => null);
    render(
      <MemoryRouter>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <NovoRhProvider module={m} modeStore={{ load: () => "real", save: () => {} }}>
            <OrgChartView />
          </NovoRhProvider>
        </QueryClientProvider>
      </MemoryRouter>,
    );
    const user = userEvent.setup();
    expect(await screen.findByRole("link", { name: "Ana Teste" })).toHaveAttribute("href", "/hr/novo/pessoas/a");
    await user.click(screen.getByRole("button", { name: "Recolher Carla Teste (2)" }));
    expect(screen.queryByRole("link", { name: "Ana Teste" })).toBeNull();
    await user.type(screen.getByRole("searchbox", { name: "Procurar no organograma" }), "bia");
    expect(screen.getByRole("link", { name: "Bia Teste" })).toBeInTheDocument();
    await user.clear(screen.getByRole("searchbox", { name: "Procurar no organograma" }));
    await user.click(screen.getByRole("button", { name: /^Expandir Carla Teste/ }));
    await user.click(screen.getByRole("button", { name: "Editar chefias" }));
    await user.click(screen.getByRole("button", { name: "Mudar a chefia de Bia Teste" }));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: /Novo responsável/ }));
    await user.click(within(screen.getByRole("option", { name: "Ana Teste" })).getByRole("button"));
    await user.click(within(dialog).getByRole("button", { name: "Confirmar" }));
    expect(m.people.setDirectManager).toHaveBeenCalledWith("b", "a", todayIn());
  });
});
