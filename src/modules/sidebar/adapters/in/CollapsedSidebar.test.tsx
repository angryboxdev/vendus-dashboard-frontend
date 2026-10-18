import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { SidebarNavEntry } from "../../domain/entities/nav-item.ts";
import { CollapsedSidebarBody } from "./CollapsedSidebar.tsx";

const TREE: SidebarNavEntry[] = [
  {
    kind: "group",
    id: "hr",
    label: "Recursos Humanos",
    icon: "people",
    basePath: "/hr",
    items: [
      { kind: "item", path: "/hr/novo/pessoas", label: "Colaboradores", icon: "people" },
      { kind: "item", path: "/hr/antigo", label: "RH antigo", icon: "legacy", badgeKey: "hr-requests" },
    ],
  },
  { kind: "item", path: "/vendus", label: "Vendus", icon: "vendus" },
];

function renderAt(path: string, overrides: Partial<Parameters<typeof CollapsedSidebarBody>[0]> = {}) {
  const props = { tree: TREE, isGroupActive: (id: string) => id === "hr" && path.startsWith("/hr"), badges: { "hr-requests": 2 }, onExpand: vi.fn(), onSignOut: vi.fn(), ...overrides };
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="*" element={<CollapsedSidebarBody {...props} />} />
      </Routes>
    </MemoryRouter>,
  );
  return props;
}

describe("Barra lateral recolhida (72 px, só ícones)", () => {
  it("itens de topo são ligações com nome acessível; o ativo fica realçado", () => {
    renderAt("/vendus");
    const vendus = screen.getByRole("link", { name: "Vendus" });
    expect(vendus).toHaveAttribute("href", "/vendus");
    expect(vendus.className).toContain("shadow-[inset_3px_0_0_#C9643A]");
  });

  it("grupo abre menu flutuante com os sub-itens (contador incluído); Esc fecha e devolve o foco", async () => {
    renderAt("/hr/novo/pessoas");
    const user = userEvent.setup();
    const hr = screen.getByRole("button", { name: "Recursos Humanos" });
    expect(hr).toHaveAttribute("aria-expanded", "false");
    expect(within(hr).getByText("2")).toBeInTheDocument();
    await user.click(hr);
    expect(hr).toHaveAttribute("aria-expanded", "true");
    const menu = screen.getByRole("menu", { name: "Recursos Humanos" });
    expect(within(menu).getByRole("menuitem", { name: "Colaboradores" })).toHaveAttribute("href", "/hr/novo/pessoas");
    expect(within(menu).getByRole("menuitem", { name: /RH antigo/ })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(hr).toHaveFocus();
  });

  it("expandir e sair são botões acessíveis", async () => {
    const props = renderAt("/vendus");
    const user = userEvent.setup();
    const expand = screen.getByRole("button", { name: "Expandir barra lateral" });
    expect(expand).toHaveAttribute("aria-expanded", "false");
    await user.click(expand);
    expect(props.onExpand).toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Sair" }));
    expect(props.onSignOut).toHaveBeenCalled();
  });
});
