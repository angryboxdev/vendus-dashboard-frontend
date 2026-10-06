import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { AccessProfile, CatalogModule, UserDetail } from "../../domain/entities/access.ts";
import type { AccessApiPort } from "../../domain/ports/out/access-api.port.ts";
import { AccessProvider } from "../../access.module.tsx";
import { UserEditorView } from "./UserEditorView.tsx";
import { ProfilesView } from "./ProfilesView.tsx";

// Dados fictícios (RGPD).
const CATALOG: CatalogModule[] = [
  {
    key: "stock",
    label: "Stock",
    description: "Artigos e movimentos.",
    functions: [
      { key: "stock.items", label: "Artigos & categorias", description: "" },
      { key: "stock.movements", label: "Movimentos", description: "" },
    ],
    specials: [{ key: "stock.count_confirm", label: "Confirmar contagens", description: "" }],
  },
];
const MANAGER: AccessProfile = {
  id: "p-manager",
  systemKey: "manager",
  name: "Manager",
  description: "Gestão operacional",
  isProtected: false,
  active: true,
  permissions: { "stock.items": "MANAGE", "stock.movements": "MANAGE" },
  userCount: 2,
  version: 1,
};
const ADMIN: AccessProfile = { ...MANAGER, id: "p-admin", systemKey: "admin", name: "Admin", isProtected: true, permissions: {}, userCount: 1 };
const USER: UserDetail = {
  userId: "u1",
  email: "gabriel@example.com",
  displayName: "Gabriel Teste",
  profile: { id: "p-manager", name: "Manager", systemKey: "manager" },
  status: "active",
  lastSignInAt: null,
  employee: null,
  isAdmin: false,
  portalOnly: false,
  modules: [],
  overridesCount: 0,
  version: 3,
  permissions: { "stock.items": "MANAGE", "stock.movements": "MANAGE", "stock.count_confirm": "NONE" },
  overrides: {},
  profilePermissions: MANAGER.permissions,
};

function api(): AccessApiPort {
  return {
    getMyAccess: vi.fn(async () => ({ profile: USER.profile, isAdmin: true, portalOnly: false, permissions: {}, modules: [], catalog: CATALOG })),
    listUsers: vi.fn(async () => []),
    getUser: vi.fn(async () => USER),
    listEmployeeOptions: vi.fn(async () => [{ id: "e1", fullName: "Gabriel Teste", linkedUserId: null }]),
    createUser: vi.fn(),
    updateUser: vi.fn(async () => USER),
    setUserStatus: vi.fn(async () => USER),
    resetPassword: vi.fn(async () => ({ temporaryPassword: "Abc23defGH45" })),
    listProfiles: vi.fn(async () => [ADMIN, MANAGER]),
    createProfile: vi.fn(async () => ({ ...MANAGER, id: "p-new", name: "Supervisor", systemKey: null })),
    updateProfile: vi.fn(async () => MANAGER),
    setProfileActive: vi.fn(async () => MANAGER),
  } as unknown as AccessApiPort;
}

function renderAt(path: string, a: AccessApiPort) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <AccessProvider module={{ api: a }}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/admin/users" element={<p>lista</p>} />
            <Route path="/admin/users/:userId" element={<UserEditorView />} />
            <Route path="/admin/access-profiles" element={<ProfilesView />} />
          </Routes>
        </MemoryRouter>
      </AccessProvider>
    </QueryClientProvider>,
  );
}

describe("Editar utilizador", () => {
  it("personaliza uma função (Personalizado + Restaurar padrão), liga a ficha e grava exceções + ficha com a versão", async () => {
    const a = api();
    renderAt("/admin/users/u1", a);
    const user = userEvent.setup();

    const items = await screen.findByLabelText("Acesso a Artigos & categorias");
    await user.selectOptions(items, "READ");
    const row = items.closest("tr")!;
    expect(within(row).getByText("Personalizado")).toBeInTheDocument();
    await user.click(within(row).getByRole("button", { name: "Restaurar padrão" }));
    expect(within(row).getByText("Herdado (Manager)")).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Acesso a Movimentos"), "NONE");
    await user.selectOptions(screen.getByLabelText("Associado a colaborador"), "e1");
    await user.click(screen.getByRole("button", { name: "Guardar alterações" }));

    expect(a.updateUser).toHaveBeenCalledWith("u1", { version: 3, overrides: { "stock.movements": "NONE" }, employeeId: "e1" });
    expect(await screen.findByText("lista")).toBeInTheDocument();
  });

  it("perfil Admin: acesso total, nada se personaliza", async () => {
    const a = api();
    renderAt("/admin/users/u1", a);
    const user = userEvent.setup();
    await screen.findByRole("option", { name: "Admin" });
    await user.selectOptions(screen.getByLabelText("Perfil de acesso"), "p-admin");
    expect(screen.getByText(/Acesso total — o perfil Admin/)).toBeInTheDocument();
    expect(screen.getByLabelText("Acesso a Artigos & categorias")).toBeDisabled();
  });
});

describe("Perfis de acesso", () => {
  it("Admin protegido; Duplicar abre o novo perfil com base no selecionado", async () => {
    const a = api();
    renderAt("/admin/access-profiles", a);
    const user = userEvent.setup();
    expect(await screen.findByText(/Este perfil é protegido/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^Manager/ }));
    await user.click(screen.getByRole("button", { name: "Duplicar" }));
    const dialog = screen.getByRole("dialog", { name: "Novo perfil" });
    await user.clear(within(dialog).getByLabelText("Nome"));
    await user.type(within(dialog).getByLabelText("Nome"), "Supervisor");
    await user.click(within(dialog).getByRole("button", { name: "Criar e configurar" }));
    expect(a.createProfile).toHaveBeenCalledWith({ name: "Supervisor", description: null, baseProfileId: "p-manager" });
  });
});
