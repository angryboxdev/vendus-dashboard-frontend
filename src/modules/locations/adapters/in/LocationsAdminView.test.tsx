import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { InMemoryLocationsApiAdapter, locationFixture } from "../out/in-memory-locations-api.adapter.ts";
import { ListLocationsUseCase } from "../../application/use-cases/list-locations.use-case.ts";
import {
  CreateLocationUseCase,
  ListLocationHistoryUseCase,
  SetLocationGeofenceUseCase,
  SetLocationActiveUseCase,
  UpdateLocationUseCase,
} from "../../application/use-cases/manage-locations.use-cases.ts";
import { LocationsProvider, type LocationsModule } from "../../locations.module.tsx";
import { LocationsAdminView } from "./LocationsAdminView.tsx";

/**
 * O `user` tem de ser o MESMO objeto entre renders — o `LocationsProvider`
 * recarrega quando `user` muda de identidade, e um objeto novo por render
 * faria um ciclo infinito (na app real o AuthContext devolve-o estável).
 */
const auth = vi.hoisted(() => ({
  value: {
    user: { id: "u1", email: "admin@exemplo.pt", role: "admin" as "admin" | "manager" | "hr_viewer", organizationId: "org-test" },
    loading: false,
  },
}));

vi.mock("../../../../contexts/AuthContext.tsx", () => ({
  useAuth: () => auth.value,
}));

function setRole(role: "admin" | "manager") {
  auth.value = { ...auth.value, user: { ...auth.value.user, role } };
}

function renderView(seed = [locationFixture({ id: "loc-mbs", name: "Mercado", code: "MBS" })]) {
  const api = InMemoryLocationsApiAdapter.withSeed(seed);
  const mod: LocationsModule = {
    listLocations: new ListLocationsUseCase(api),
    createLocation: new CreateLocationUseCase(api),
    updateLocation: new UpdateLocationUseCase(api),
    setLocationActive: new SetLocationActiveUseCase(api),
    listLocationHistory: new ListLocationHistoryUseCase(api),
    setLocationGeofence: new SetLocationGeofenceUseCase(api),
    readCurrentPosition: { execute: async () => ({ latitude: 41.1, longitude: -8.6, accuracyM: 5 }) },
  };
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <LocationsProvider module={mod}>
        <LocationsAdminView />
      </LocationsProvider>
    </QueryClientProvider>,
  );
  return api;
}

describe("LocationsAdminView", () => {
  it("admin cria um local e ele aparece na lista", async () => {
    setRole("admin");
    renderView();
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Novo local" }));
    const dialog = screen.getByRole("dialog", { name: "Novo local" });
    await user.type(within(dialog).getByLabelText(/^Nome/), "Armazém");
    await user.click(within(dialog).getByRole("button", { name: "Criar local" }));

    expect(await screen.findByText("Armazém")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("código duplicado mostra o erro junto do campo", async () => {
    setRole("admin");
    renderView();
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Novo local" }));
    const dialog = screen.getByRole("dialog", { name: "Novo local" });
    await user.type(within(dialog).getByLabelText(/^Nome/), "Outro");
    await user.type(within(dialog).getByLabelText(/Código interno/), "MBS");
    await user.click(within(dialog).getByRole("button", { name: "Criar local" }));

    expect(await within(dialog).findByText("já usado noutro local")).toBeInTheDocument();
  });

  it("inativar pede confirmação e o local sai da lista sem ser apagado", async () => {
    setRole("admin");
    const api = renderView();
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Inativar" }));
    const confirm = screen.getByRole("alertdialog");
    expect(within(confirm).getByText(/histórico associados/)).toBeInTheDocument();
    await user.click(within(confirm).getByRole("button", { name: "Inativar" }));

    await waitFor(() => expect(screen.queryByText("Mercado")).not.toBeInTheDocument());
    expect((await api.listLocations()).map((l) => l.id)).toContain("loc-mbs");

    await user.click(screen.getByLabelText(/Mostrar inativos/));
    expect(screen.getByText("Mercado")).toBeInTheDocument();
    expect(screen.getByText("Inativo")).toBeInTheDocument();
  });

  it("não-admin só vê a lista", async () => {
    setRole("manager");
    renderView();

    expect(await screen.findByText("Mercado")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Novo local" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Editar" })).not.toBeInTheDocument();
  });
});
