import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { fireEvent } from "@testing-library/react";
import { useState } from "react";
import { AlertBanner, Button, Drawer, PageShell, StatusBadge, Tabs, TimePicker, buttonClass } from "./index.ts";

function TimeHarness() {
  const [v, setV] = useState("23:58");
  return <TimePicker label="Hora de início" value={v} onChange={setV} />;
}

describe("components/ui — identidade visual Mezza ERP", () => {
  it("botão primário é cobre preenchido; secundário tem contorno navy", () => {
    expect(buttonClass("primary")).toContain("bg-brand-600 text-white");
    expect(buttonClass("secondary")).toContain("border border-navy-900/20");
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

  it("TimePicker: roda de horas e minutos sem escrever (teclado, roda do rato, clique; dá a volta)", async () => {
    const user = userEvent.setup();
    render(<TimeHarness />);
    await user.click(screen.getByRole("button", { name: "Hora de início: 23:58" }));
    const minutes = screen.getByRole("listbox", { name: "Minutos" });
    minutes.focus();
    await user.keyboard("{ArrowDown}{ArrowDown}");
    expect(screen.getByRole("button", { name: "Hora de início: 23:00" })).toBeInTheDocument();
    fireEvent.wheel(screen.getByRole("listbox", { name: "Horas" }), { deltaY: 100 });
    expect(screen.getByRole("button", { name: "Hora de início: 00:00" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Horas: anterior" }));
    await user.click(within(screen.getByRole("listbox", { name: "Minutos" })).getByRole("option", { name: "03" }));
    expect(screen.getByRole("button", { name: "Hora de início: 23:03" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "23", selected: true })).toBeInTheDocument();
  });

  it("TimePicker: ao abrir, o foco vai para as horas; Enter fecha e devolve o foco ao campo", async () => {
    const user = userEvent.setup();
    render(<TimeHarness />);
    await user.click(screen.getByRole("button", { name: "Hora de início: 23:58" }));
    expect(screen.getByRole("listbox", { name: "Horas" })).toHaveFocus();
    await user.keyboard("{ArrowDown}{Enter}");
    expect(screen.queryByRole("listbox", { name: "Horas" })).toBeNull();
    expect(screen.getByRole("button", { name: "Hora de início: 00:58" })).toHaveFocus();
  });
});
