import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { UserMenu } from "./UserMenu.tsx";

describe("Menu do utilizador (barra de topo)", () => {
  it("avatar com iniciais; abre com o email e 'Sair'", async () => {
    const out = vi.fn();
    render(<UserMenu email="ana.pereira@demo.invalid" onSignOut={out} />);
    const btn = screen.getByRole("button", { name: "Conta: ana.pereira@demo.invalid" });
    expect(btn).toHaveTextContent("AP");
    await userEvent.click(btn);
    expect(screen.getByText("ana.pereira@demo.invalid")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("menuitem", { name: "Sair" }));
    expect(out).toHaveBeenCalledTimes(1);
  });
});
