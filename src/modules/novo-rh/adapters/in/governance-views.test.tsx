import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { Group } from "../../domain/entities/governance.ts";
import { groupTree } from "../../domain/services/structure.service.ts";
import { fakeNovoRhModule } from "../../fake-module.test-utils.ts";
import { NovoRhProvider, type NovoRhModule } from "../../novo-rh.module.tsx";
import { AccessView } from "./access/AccessView.tsx";
import { AuditView } from "./audit/AuditView.tsx";
import { NotificationsBell } from "./NotificationsBell.tsx";
import { StructureView } from "./structure/StructureView.tsx";

function renderWith(ui: ReactNode, mod: NovoRhModule) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <MemoryRouter>
      <QueryClientProvider client={qc}>
        <NovoRhProvider module={mod}>{ui}</NovoRhProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

const G = (id: string, parentId: string | null, name: string): Group => ({ id, parentId, code: id.toUpperCase(), name, color: "#ED5C32", description: null, hidden: false, archived: false, etag: `"${id}"` });

describe("Novo RH → Estrutura", () => {
  it("grupos em árvore (pai antes dos filhos; pai inexistente vai para a raiz)", () => {
    const tree = groupTree([G("c", "b", "Turno noite"), G("a", null, "Equipa A"), G("b", "a", "Cozinha A"), G("x", "nao-existe", "Solto")]);
    expect(tree.map((n) => [n.group.name, n.depth])).toEqual([
      ["Equipa A", 0],
      ["Cozinha A", 1],
      ["Turno noite", 2],
      ["Solto", 0],
    ]);
  });

  it("cria departamento e grupo; mostra a árvore", async () => {
    const mod = fakeNovoRhModule({ settings: { listEmployees: vi.fn(async () => []) } as unknown as NovoRhModule["settings"] });
    mod.structure.listGroups = vi.fn(async () => [G("a", null, "Equipa A"), G("b", "a", "Cozinha A")]);
    mod.structure.createDepartment = vi.fn(async (name: string) => ({ id: "d1", name, archived: false, etag: '"1"' }));
    mod.structure.createGroup = vi.fn(async () => G("n", null, "Novo"));
    renderWith(<StructureView />, mod);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Novo departamento"), "Sala");
    await user.click(within(screen.getByRole("region", { name: "Departamentos" })).getByRole("button", { name: "Adicionar" }));
    expect(mod.structure.createDepartment).toHaveBeenCalledWith("Sala");
    const groups = screen.getByRole("region", { name: "Grupos" });
    expect(await within(groups).findByText("Cozinha A", { selector: "li span" })).toBeInTheDocument();
    await user.type(within(groups).getByLabelText("Nome"), "Turno noite");
    await user.type(within(groups).getByLabelText("Código"), "NOITE");
    await user.selectOptions(within(groups).getByLabelText("Dentro de"), "b");
    await user.click(within(groups).getByRole("button", { name: "Adicionar" }));
    expect(mod.structure.createGroup).toHaveBeenCalledWith(expect.objectContaining({ name: "Turno noite", code: "NOITE", parentId: "b" }));
  });
});

describe("Novo RH → Acessos", () => {
  it("privacidade por campo: editar exige ver; guarda as alterações", async () => {
    const mod = fakeNovoRhModule();
    mod.access.listProfiles = vi.fn(async () => [{ id: "p-rh", name: "RH", systemKey: "rh" }]);
    mod.access.profileGovernance = vi.fn(async () => ({
      scopeKind: "general" as const,
      fields: [{ key: "identification.iban", label: "IBAN", group: "identification", sensitive: true, view: false, edit: false, customized: false }],
    }));
    mod.access.setFieldPrivacy = vi.fn(async () => ({ scopeKind: "general" as const, fields: [] }));
    renderWith(<AccessView />, mod);
    const user = userEvent.setup();
    await screen.findByRole("option", { name: "RH" });
    await user.selectOptions(screen.getByRole("combobox", { name: "Perfil de acesso" }), "p-rh");
    const edit = await screen.findByLabelText("Editar IBAN");
    expect(edit).toBeDisabled();
    await user.click(screen.getByLabelText("Ver IBAN"));
    await user.click(edit);
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    expect(mod.access.setFieldPrivacy).toHaveBeenCalledWith("p-rh", [{ fieldKey: "identification.iban", canView: true, canEdit: true }]);
  });
});

describe("Novo RH → Auditoria e notificações", () => {
  it("verificação da cadeia mostra o registo quebrado", async () => {
    const mod = fakeNovoRhModule();
    mod.audit.verify = vi.fn(async () => ({ intact: false, brokenAtSeq: 42 }));
    renderWith(<AuditView />, mod);
    await userEvent.setup().click(screen.getByRole("button", { name: "Verificar integridade" }));
    expect(await screen.findByText("Atenção: a cadeia está quebrada a partir do registo n.º 42.")).toBeInTheDocument();
  });

  it("sino com contador; abre a lista e marca todas como lidas", async () => {
    const mod = fakeNovoRhModule();
    mod.notifications.unreadCount = vi.fn(async () => 2);
    mod.notifications.list = vi.fn(async () => [{ id: "n1", kind: "settings.retroactive_change", title: "Alteração retroativa", body: null, link: "/hr/novo/configuracoes", createdAt: "2026-10-11T10:00:00Z", readAt: null }]);
    renderWith(<NotificationsBell />, mod);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Notificações — 2 por ler" }));
    expect(await screen.findByRole("link", { name: "Alteração retroativa" })).toHaveAttribute("href", "/hr/novo/configuracoes");
    await user.click(screen.getByRole("button", { name: "Marcar todas como lidas" }));
    expect(mod.notifications.markAllRead).toHaveBeenCalled();
  });
});
