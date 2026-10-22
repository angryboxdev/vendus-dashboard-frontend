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
type Link = { employeeId: string; managerEmployeeId: string };

function setup(names: [string, string][], links: Link[]) {
  const m = fakeNovoRhModule({ settings: { listLocations: vi.fn(async () => []), listEmployees: vi.fn(async () => []) } as unknown as NovoRhModule["settings"] });
  m.people.list = vi.fn(async () => names.map(([id, n]) => person(id, n)));
  m.people.listPositions = vi.fn(async () => []);
  m.people.orgChart = vi.fn(async () => links.map((l, i) => ({ ...l, linkId: String(i), validFrom: "2026-01-01" })));
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
  return { m, user: userEvent.setup() };
}
const cardOf = (name: string) => screen.getByText(name).closest("div[draggable]") as HTMLElement;

describe("Mais → Organograma", () => {
  it("árvore por chefia, pesquisa e recolher; o nome abre a ficha fora de «Organizar»", async () => {
    const { user } = setup([["ceo", "Carla Teste"], ["a", "Ana Teste"], ["b", "Bia Teste"]], [
      { employeeId: "a", managerEmployeeId: "ceo" },
      { employeeId: "b", managerEmployeeId: "ceo" },
    ]);
    expect(await screen.findByRole("link", { name: "Ana Teste" })).toHaveAttribute("href", "/hr/novo/pessoas/a");
    await user.click(screen.getByRole("button", { name: "Recolher Carla Teste (2)" }));
    expect(screen.queryByRole("link", { name: "Ana Teste" })).toBeNull();
    await user.type(screen.getByRole("searchbox", { name: "Procurar no organograma" }), "bia");
    expect(screen.getByRole("link", { name: "Bia Teste" })).toBeInTheDocument();
  });

  it("rascunho: subir, descer, desfazer e só grava ao «Guardar»", async () => {
    const { m, user } = setup([["ceo", "Carla Teste"], ["a", "Ana Teste"], ["b", "Bia Teste"]], [
      { employeeId: "a", managerEmployeeId: "ceo" },
      { employeeId: "b", managerEmployeeId: "a" },
    ]);
    await screen.findByRole("link", { name: "Bia Teste" });
    await user.click(screen.getByRole("button", { name: "Organizar" }));
    expect(screen.queryByRole("link", { name: "Bia Teste" })).toBeNull(); // a organizar, o nome não abre a ficha
    expect(screen.getByRole("button", { name: "Subir Carla Teste um nível" })).toBeDisabled();
    // ↑ Bia passa para o lado da Ana; ↓ volta para baixo dela (= ao que está gravado); ↑ outra vez.
    await user.click(screen.getByRole("button", { name: "Subir Bia Teste um nível" }));
    expect(screen.getByText("1 alteração(ões) por guardar")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Descer Bia Teste um nível" }));
    expect(screen.queryByText(/alteração\(ões\) por guardar/)).toBeNull();
    await user.click(screen.getByRole("button", { name: "Subir Bia Teste um nível" }));
    await user.click(screen.getByRole("button", { name: "Subir Ana Teste um nível" }));
    expect(screen.getByText("2 alteração(ões) por guardar")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Desfazer" }));
    expect(screen.getByText("1 alteração(ões) por guardar")).toBeInTheDocument();
    expect(m.people.setDirectManagers).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    expect(m.people.setDirectManagers).toHaveBeenCalledTimes(1);
    expect(m.people.setDirectManagers).toHaveBeenCalledWith("b", ["ceo"], todayIn());
  });

  it("Mover por clique e trocar de lugar (pôr o Kleiton abaixo do Gabriel, que hoje está abaixo dele)", async () => {
    const { m, user } = setup([["raul", "Raul Teste"], ["k", "Kleiton Teste"], ["g", "Gabriel Teste"]], [
      { employeeId: "k", managerEmployeeId: "raul" },
      { employeeId: "g", managerEmployeeId: "k" },
    ]);
    await screen.findByRole("link", { name: "Gabriel Teste" });
    await user.click(screen.getByRole("button", { name: "Organizar" }));
    await user.click(screen.getByRole("button", { name: "Mover Kleiton Teste" }));
    expect(screen.getByText(/A mover Kleiton Teste/)).toBeInTheDocument();
    await user.click(cardOf("Gabriel Teste"));
    expect(screen.getByText("2 alteração(ões) por guardar")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    // De cima para baixo: primeiro o Gabriel sobe para o lugar do Kleiton, depois o Kleiton passa para baixo dele.
    expect(m.people.setDirectManagers).toHaveBeenNthCalledWith(1, "g", ["raul"], todayIn());
    expect(m.people.setDirectManagers).toHaveBeenNthCalledWith(2, "k", ["g"], todayIn());
  });

  it("↓ Descer: colegas são quem está lado a lado (mesmo com responsáveis diferentes por baixo do cartão conjunto)", async () => {
    const { m, user } = setup([["raul", "Raul Teste"], ["bruno", "Bruno Teste"], ["g", "Gabriel Teste"], ["k", "Kleiton Teste"]], [
      { employeeId: "g", managerEmployeeId: "raul" },
      { employeeId: "g", managerEmployeeId: "bruno" },
      { employeeId: "k", managerEmployeeId: "raul" },
    ]);
    const group = await screen.findByRole("group", { name: "Chefia partilhada: Bruno Teste + Raul Teste" });
    expect(within(group).getByRole("link", { name: "Raul Teste" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Organizar" }));
    await user.click(screen.getByRole("button", { name: "Descer Kleiton Teste um nível" }));
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    expect(m.people.setDirectManagers).toHaveBeenCalledWith("k", ["g"], todayIn());
  });

  it("⋯: co-chefia — o gerente passa a reportar aos dois sócios", async () => {
    const { m, user } = setup([["raul", "Raul Teste"], ["bruno", "Bruno Teste"], ["gab", "Gabriel Teste"]], [{ employeeId: "gab", managerEmployeeId: "raul" }]);
    await screen.findByRole("link", { name: "Gabriel Teste" });
    await user.click(screen.getByRole("button", { name: "Organizar" }));
    await user.click(screen.getByRole("button", { name: "Responsáveis de Gabriel Teste" }));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: /^Acrescentar \(chefia partilhada\):/ }));
    await user.click(within(screen.getByRole("option", { name: "Bruno Teste" })).getByRole("button"));
    expect(dialog).toHaveTextContent("Gabriel Teste passa a reportar a Raul Teste e Bruno Teste.");
    await user.click(within(dialog).getByRole("button", { name: "Aplicar" }));
    expect(await screen.findByRole("group", { name: "Chefia partilhada: Bruno Teste + Raul Teste" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    expect(m.people.setDirectManagers).toHaveBeenCalledWith("gab", ["raul", "bruno"], todayIn());
  });
});
