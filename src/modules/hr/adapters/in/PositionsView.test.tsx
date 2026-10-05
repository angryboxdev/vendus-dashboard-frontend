import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../../../../lib/api.ts";
import type { Position, PositionPayload } from "../../domain/entities/position.ts";
import type { HrApiPort } from "../../domain/ports/out/hr-api.port.ts";
import { HrProvider } from "../../hr.module.tsx";
import { PositionsView } from "./PositionsView.tsx";

/** Objeto estável entre renders (ver nota no teste de LocationsAdminView). */
const auth = vi.hoisted(() => ({
  value: { user: { id: "u1", email: "rh@exemplo.pt", role: "manager" as "admin" | "manager" | "hr_viewer", organizationId: "org" }, loading: false },
}));
vi.mock("../../../../contexts/AuthContext.tsx", () => ({ useAuth: () => auth.value }));

function setRole(role: "manager" | "hr_viewer") {
  auth.value = { ...auth.value, user: { ...auth.value.user, role } };
}

/** API falsa só com o que a aba Cargos usa; reproduz o 409 de nome duplicado do backend. */
function fakeApi(seed: Position[]) {
  let positions = [...seed];
  const normalize = (n: string) => n.trim().replace(/\s+/g, " ").toLowerCase();
  const api = {
    listPositions: async () => positions,
    createPosition: async (payload: PositionPayload) => {
      if (positions.some((p) => normalize(p.name) === normalize(payload.name!))) {
        throw new ApiError(`Já existe um cargo com o nome "${payload.name}"`, 409);
      }
      const created: Position = {
        id: `p${positions.length + 1}`,
        name: payload.name!.trim(),
        description: payload.description ?? null,
        operationalCategory: payload.operationalCategory!,
        active: true,
        employeeCount: 0,
        updatedAt: "",
      };
      positions = [...positions, created];
      return created;
    },
    updatePosition: async () => positions[0]!,
    setPositionActive: async (id: string, active: boolean) => {
      positions = positions.map((p) => (p.id === id ? { ...p, active } : p));
      return positions.find((p) => p.id === id)!;
    },
  };
  return api as unknown as HrApiPort;
}

function renderView(seed: Position[]) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <HrProvider module={{ api: fakeApi(seed) }}>
          <PositionsView />
        </HrProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const PREP: Position = { id: "p1", name: "Preparador de Pizzas", description: null, operationalCategory: "prep", active: true, employeeCount: 3, updatedAt: "" };

describe("PositionsView", () => {
  it("lista os cargos com o nº de colaboradores e as abas de Colaboradores", async () => {
    setRole("manager");
    renderView([PREP]);

    expect(await screen.findByText("Preparador de Pizzas")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    for (const tab of ["Lista", "Cargos", "Documentos"]) expect(screen.getByRole("link", { name: tab })).toBeInTheDocument();
  });

  it("cria um cargo novo", async () => {
    setRole("manager");
    renderView([PREP]);
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Novo cargo" }));
    const dialog = screen.getByRole("dialog", { name: "Novo cargo" });
    await user.type(within(dialog).getByLabelText(/^Nome/), "Gerente de Loja");
    await user.selectOptions(within(dialog).getByLabelText("Categoria nas Escalas"), "manager");
    await user.click(within(dialog).getByRole("button", { name: "Criar cargo" }));

    expect(await screen.findByText("Gerente de Loja")).toBeInTheDocument();
  });

  it("nome duplicado ('preparador de pizzas') mostra erro e não cria segundo cargo", async () => {
    setRole("manager");
    renderView([PREP]);
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Novo cargo" }));
    const dialog = screen.getByRole("dialog", { name: "Novo cargo" });
    await user.type(within(dialog).getByLabelText(/^Nome/), " preparador  DE pizzas ");
    await user.click(within(dialog).getByRole("button", { name: "Criar cargo" }));

    expect(await within(dialog).findByText("Já existe um cargo com este nome.")).toBeInTheDocument();
  });

  it("hr_viewer só vê a lista", async () => {
    setRole("hr_viewer");
    renderView([PREP]);

    expect(await screen.findByText("Preparador de Pizzas")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Novo cargo" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Inativar" })).not.toBeInTheDocument();
  });
});
