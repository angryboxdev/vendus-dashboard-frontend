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
    m.people.setDirectManagers = vi.fn(async () => []);
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
    await user.click(screen.getByRole("button", { name: "Organizar" }));
    await user.click(screen.getByRole("button", { name: "Responsáveis de Bia Teste" }));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: /^Responsável:/ }));
    await user.click(within(screen.getByRole("option", { name: "Ana Teste" })).getByRole("button"));
    await user.click(within(dialog).getByRole("button", { name: "Confirmar" }));
    expect(m.people.setDirectManagers).toHaveBeenCalledWith("b", ["a"], todayIn());
  });

  it("organizar: ↑ Subir vai para a chefia acima; Mover por clique escolhe o novo responsável", async () => {
    const m = fakeNovoRhModule({ settings: { listLocations: vi.fn(async () => []), listEmployees: vi.fn(async () => []) } as unknown as NovoRhModule["settings"] });
    m.people.list = vi.fn(async () => [person("ceo", "Carla Teste"), person("a", "Ana Teste"), person("b", "Bia Teste")]);
    m.people.listPositions = vi.fn(async () => []);
    m.people.orgChart = vi.fn(async () => [
      { employeeId: "a", managerEmployeeId: "ceo", linkId: "1", validFrom: "2026-01-01" },
      { employeeId: "b", managerEmployeeId: "a", linkId: "2", validFrom: "2026-01-01" },
    ]);
    m.people.setDirectManagers = vi.fn(async () => []);
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
    await screen.findByRole("link", { name: "Bia Teste" });
    await user.click(screen.getByRole("button", { name: "Organizar" }));
    expect(screen.getByRole("button", { name: "Subir Carla Teste um nível" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Subir Bia Teste um nível" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Confirmar" }));
    expect(m.people.setDirectManagers).toHaveBeenLastCalledWith("b", ["ceo"], todayIn());
    await user.click(screen.getByRole("button", { name: "Mover Bia Teste" }));
    expect(screen.getByText(/A mover Bia Teste/)).toBeInTheDocument();
    await user.click(screen.getByText("Carla Teste").closest("div[draggable]")!);
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Confirmar" }));
    expect(m.people.setDirectManagers).toHaveBeenLastCalledWith("b", ["ceo"], todayIn());
  });

  it("co-chefia: o gerente pode reportar aos dois sócios (acrescentar no diálogo); a organizar, o nome não abre a ficha", async () => {
    const m = fakeNovoRhModule({ settings: { listLocations: vi.fn(async () => []), listEmployees: vi.fn(async () => []) } as unknown as NovoRhModule["settings"] });
    m.people.list = vi.fn(async () => [person("raul", "Raul Teste"), person("bruno", "Bruno Teste"), person("gab", "Gabriel Teste")]);
    m.people.listPositions = vi.fn(async () => []);
    m.people.orgChart = vi.fn(async () => [{ employeeId: "gab", managerEmployeeId: "raul", linkId: "1", validFrom: "2026-01-01" }]);
    m.people.setDirectManagers = vi.fn(async () => []);
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
    await screen.findByRole("link", { name: "Gabriel Teste" });
    await user.click(screen.getByRole("button", { name: "Organizar" }));
    expect(screen.queryByRole("link", { name: "Gabriel Teste" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Responsáveis de Gabriel Teste" }));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: /^Acrescentar \(chefia partilhada\):/ }));
    await user.click(within(screen.getByRole("option", { name: "Bruno Teste" })).getByRole("button"));
    expect(dialog).toHaveTextContent("Gabriel Teste passa a reportar a Raul Teste e Bruno Teste.");
    await user.click(within(dialog).getByRole("button", { name: "Confirmar" }));
    expect(m.people.setDirectManagers).toHaveBeenCalledWith("gab", ["raul", "bruno"], todayIn());
  });

  it("co-chefia: quem reporta aos dois sócios aparece por baixo do cartão conjunto", async () => {
    const m = fakeNovoRhModule({ settings: { listLocations: vi.fn(async () => []), listEmployees: vi.fn(async () => []) } as unknown as NovoRhModule["settings"] });
    m.people.list = vi.fn(async () => [person("raul", "Raul Teste"), person("bruno", "Bruno Teste"), person("gab", "Gabriel Teste")]);
    m.people.listPositions = vi.fn(async () => []);
    m.people.orgChart = vi.fn(async () => [
      { employeeId: "gab", managerEmployeeId: "raul", linkId: "1", validFrom: "2026-01-01" },
      { employeeId: "gab", managerEmployeeId: "bruno", linkId: "2", validFrom: "2026-01-01" },
    ]);
    render(
      <MemoryRouter>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <NovoRhProvider module={m} modeStore={{ load: () => "real", save: () => {} }}>
            <OrgChartView />
          </NovoRhProvider>
        </QueryClientProvider>
      </MemoryRouter>,
    );
    const group = await screen.findByRole("group", { name: "Chefia partilhada: Bruno Teste + Raul Teste" });
    expect(within(group).getByRole("link", { name: "Raul Teste" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Recolher Bruno Teste + Raul Teste (1)" })).toBeInTheDocument();
  });

  it("trocar de lugar: pôr o Kleiton abaixo do Gabriel quando hoje o Gabriel está abaixo do Kleiton", async () => {
    const m = fakeNovoRhModule({ settings: { listLocations: vi.fn(async () => []), listEmployees: vi.fn(async () => []) } as unknown as NovoRhModule["settings"] });
    m.people.list = vi.fn(async () => [person("raul", "Raul Teste"), person("k", "Kleiton Teste"), person("g", "Gabriel Teste")]);
    m.people.listPositions = vi.fn(async () => []);
    m.people.orgChart = vi.fn(async () => [
      { employeeId: "k", managerEmployeeId: "raul", linkId: "1", validFrom: "2026-01-01" },
      { employeeId: "g", managerEmployeeId: "k", linkId: "2", validFrom: "2026-01-01" },
    ]);
    m.people.setDirectManagers = vi.fn(async () => []);
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
    await screen.findByRole("link", { name: "Gabriel Teste" });
    await user.click(screen.getByRole("button", { name: "Organizar" }));
    await user.click(screen.getByRole("button", { name: "Mover Kleiton Teste" }));
    await user.click(screen.getByText("Gabriel Teste").closest("div[draggable]")!);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("Gabriel Teste passa para o lugar de Kleiton Teste (a reportar a Raul Teste)");
    await user.click(within(dialog).getByRole("button", { name: "Confirmar" }));
    expect(m.people.setDirectManagers).toHaveBeenNthCalledWith(1, "g", ["raul"], todayIn());
    expect(m.people.setDirectManagers).toHaveBeenNthCalledWith(2, "k", ["g"], todayIn());
  });

  it("↓ Descer: colegas são quem está lado a lado (mesmo com responsáveis diferentes por baixo do cartão conjunto)", async () => {
    const m = fakeNovoRhModule({ settings: { listLocations: vi.fn(async () => []), listEmployees: vi.fn(async () => []) } as unknown as NovoRhModule["settings"] });
    m.people.list = vi.fn(async () => [person("raul", "Raul Teste"), person("bruno", "Bruno Teste"), person("g", "Gabriel Teste"), person("k", "Kleiton Teste")]);
    m.people.listPositions = vi.fn(async () => []);
    m.people.orgChart = vi.fn(async () => [
      { employeeId: "g", managerEmployeeId: "raul", linkId: "1", validFrom: "2026-01-01" },
      { employeeId: "g", managerEmployeeId: "bruno", linkId: "2", validFrom: "2026-01-01" },
      { employeeId: "k", managerEmployeeId: "raul", linkId: "3", validFrom: "2026-01-01" },
    ]);
    m.people.setDirectManagers = vi.fn(async () => []);
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
    await screen.findByRole("link", { name: "Kleiton Teste" });
    await user.click(screen.getByRole("button", { name: "Organizar" }));
    const down = screen.getByRole("button", { name: "Descer Kleiton Teste um nível" });
    expect(down).toBeEnabled();
    await user.click(down);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("Kleiton Teste passa a reportar a Gabriel Teste.");
    await user.click(within(dialog).getByRole("button", { name: "Confirmar" }));
    expect(m.people.setDirectManagers).toHaveBeenCalledWith("k", ["g"], todayIn());
  });
});
