import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { fakeNovoRhModule } from "../../../fake-module.test-utils.ts";
import { NovoRhProvider } from "../../../novo-rh.module.tsx";
import { CatalogSections } from "./CatalogSections.tsx";

// Dados fictícios (RGPD).
const P = (id: string, name: string, active = true, employeeCount = 0) => ({ id, name, description: null, active, employeeCount, updatedAt: "2026-10-22T10:00:00Z" });

describe("Configurações → Estrutura → Cargos", () => {
  it("lista, cria, edita e desativa; desativados escondidos até pedir", async () => {
    const m = fakeNovoRhModule();
    m.people.listPositionDetails = vi.fn(async () => [P("p1", "Gerente de loja", true, 3), P("p2", "Copeiro", false)]);
    m.people.createPosition = vi.fn(async (i) => P("p3", i.name));
    m.people.updatePosition = vi.fn(async () => P("p1", "Gerente"));
    m.people.setPositionActive = vi.fn(async () => P("p1", "Gerente de loja", false));
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <NovoRhProvider module={m} modeStore={{ load: () => "real", save: () => {} }}>
          <CatalogSections />
        </NovoRhProvider>
      </QueryClientProvider>,
    );
    const user = userEvent.setup();
    const section = await screen.findByRole("region", { name: "Cargos" });
    const row = await within(section).findByRole("row", { name: /Gerente de loja/ });
    expect(row).toHaveTextContent("3");
    expect(within(section).queryByText("Copeiro")).toBeNull();
    await user.click(within(section).getByRole("checkbox", { name: /Mostrar desativados \(1\)/ }));
    expect(within(section).getByText("Copeiro")).toBeInTheDocument();

    await user.type(within(section).getByLabelText("Nome do cargo"), "Chefe de sala");
    await user.click(within(section).getByRole("button", { name: "Adicionar" }));
    expect(m.people.createPosition).toHaveBeenCalledWith({ name: "Chefe de sala", description: null });

    await user.click(within(row).getByRole("button", { name: "Editar" }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("3 colaborador(es) têm este cargo");
    const name = within(dialog).getByLabelText("Nome");
    await user.clear(name);
    await user.type(name, "Gerente");
    await user.click(within(dialog).getByRole("button", { name: "Guardar" }));
    expect(m.people.updatePosition).toHaveBeenCalledWith("p1", { name: "Gerente", description: null });

    await user.click(within(row).getByRole("button", { name: "Desativar" }));
    expect(m.people.setPositionActive).toHaveBeenCalledWith("p1", false);
  });
});
