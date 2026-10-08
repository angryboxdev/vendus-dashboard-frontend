import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AlertBanner, Button, Drawer, PageShell, StatusBadge, Tabs, buttonClass } from "./index.ts";

describe("components/ui — identidade visual Mezza ERP", () => {
  it("botão primário usa o gradiente da marca; secundário tem borda", () => {
    expect(buttonClass("primary")).toContain("bg-gradient-to-r from-[#ED5C32] to-[#EF8935]");
    expect(buttonClass("secondary")).toContain("border border-stone-300 bg-white");
  });

  it("página: título, descrição, ação e tabs", () => {
    render(
      <PageShell title="Colaboradores" description="Gestão" actions={<Button variant="primary">Novo</Button>}>
        <p>conteúdo</p>
      </PageShell>,
    );
    expect(screen.getByRole("heading", { level: 1, name: "Colaboradores" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Novo" })).toBeInTheDocument();
    expect(screen.getByText("conteúdo")).toBeInTheDocument();
  });

  it("tabs: aba ativa marcada e mudança por clique, com contador", async () => {
    const onChange = vi.fn();
    render(<Tabs value="a" onChange={onChange} items={[{ key: "a", label: "Todos", count: 3 }, { key: "b", label: "Pendentes" }]} />);
    expect(screen.getByRole("tab", { name: /Todos/ })).toHaveAttribute("aria-selected", "true");
    await userEvent.setup().click(screen.getByRole("tab", { name: "Pendentes" }));
    expect(onChange).toHaveBeenCalledWith("b");
  });

  it("painel lateral: título, rodapé e fecha com Esc ou no botão", async () => {
    const onClose = vi.fn();
    render(
      <Drawer open title="Registar ausência" onClose={onClose} footer={<Button>Guardar</Button>}>
        <p>campos</p>
      </Drawer>,
    );
    expect(screen.getByRole("dialog", { name: "Registar ausência" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar" })).toBeInTheDocument();
    const user = userEvent.setup();
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Fechar" }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("estado e alerta com semântica", () => {
    render(
      <>
        <StatusBadge tone="warning">Pendente</StatusBadge>
        <AlertBanner tone="warning" title="Requer atenção">
          3 pedidos
        </AlertBanner>
      </>,
    );
    expect(screen.getByText("Pendente").className).toContain("bg-amber-50");
    expect(screen.getByRole("alert")).toHaveTextContent("Requer atenção3 pedidos");
  });
});
