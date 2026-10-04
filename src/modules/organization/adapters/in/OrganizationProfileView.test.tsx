import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { InMemoryOrganizationApiAdapter } from "../out/in-memory-organization-api.adapter.ts";
import {
  GetOrganizationProfileUseCase,
  ListOrganizationHistoryUseCase,
  UpdateOrganizationProfileUseCase,
  UploadOrganizationLogoUseCase,
} from "../../application/use-cases/organization.use-cases.ts";
import { OrganizationProvider, type OrganizationModule } from "../../organization.module.tsx";
import { OrganizationProfileView } from "./OrganizationProfileView.tsx";

const auth = vi.hoisted(() => ({ role: "admin" as "admin" | "manager" | "hr_viewer" }));

vi.mock("../../../../contexts/AuthContext.tsx", () => ({
  useAuth: () => ({ user: { id: "u1", email: "admin@exemplo.pt", role: auth.role, organizationId: "org-test" } }),
}));

function renderView(api = new InMemoryOrganizationApiAdapter()) {
  const mod: OrganizationModule = {
    getProfile: new GetOrganizationProfileUseCase(api),
    updateProfile: new UpdateOrganizationProfileUseCase(api),
    uploadLogo: new UploadOrganizationLogoUseCase(api),
    listHistory: new ListOrganizationHistoryUseCase(api),
  };
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <OrganizationProvider module={mod}>
          <OrganizationProfileView />
        </OrganizationProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return api;
}

describe("OrganizationProfileView", () => {
  it("admin grava alterações e vê a confirmação", async () => {
    auth.role = "admin";
    const api = renderView();
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText(/Razão social/), "Exemplo Restauração, Lda");
    await user.click(screen.getByRole("button", { name: "Guardar alterações" }));

    expect(await screen.findByText("Alterações guardadas.")).toBeInTheDocument();
    expect(api.updateCalls).toEqual([{ legalName: "Exemplo Restauração, Lda" }]);
  });

  it("mostra o erro do backend junto do campo", async () => {
    auth.role = "admin";
    renderView();
    const user = userEvent.setup();

    const nif = await screen.findByLabelText(/^NIF/);
    await user.clear(nif);
    await user.type(nif, "12AB");
    await user.type(screen.getByLabelText(/Razão social/), "Exemplo, Lda");
    await user.click(screen.getByRole("button", { name: "Guardar alterações" }));

    expect(await screen.findByText("NIF português inválido")).toBeInTheDocument();
    expect(screen.getByText("Corrija os campos assinalados.")).toBeInTheDocument();
  });

  it("não-admin vê os dados só em leitura", async () => {
    auth.role = "manager";
    renderView();

    expect(await screen.findByLabelText(/Nome comercial/)).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Guardar alterações" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /logotipo/ })).not.toBeInTheDocument();
    expect(screen.getByText("Só administradores podem editar os dados da empresa.")).toBeInTheDocument();
  });
});
