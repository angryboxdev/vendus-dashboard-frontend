import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { EmployeePortalProvider, type EmployeePortalModule } from "../../employee-portal.module.tsx";
import { PortalLayout } from "./PortalLayout.tsx";

vi.mock("../../../../contexts/AuthContext.tsx", () => ({ useAuth: () => ({ user: { id: "u1", mustChangePassword: false } }) }));

function renderLayout(pendingCount: () => Promise<number>) {
  const mod = {
    getHome: { execute: vi.fn() },
    registerPunch: { execute: vi.fn() },
    selfService: {},
    engagement: { pendingCount },
    newIdempotencyKey: () => "k",
  } as unknown as EmployeePortalModule;
  render(
    <MemoryRouter initialEntries={["/portal"]}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <EmployeePortalProvider module={mod}>
          <PortalLayout />
        </EmployeePortalProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe("PortalLayout — número no «Mais»", () => {
  it("com comunicados/tarefas por tratar mostra o número laranja no «Mais»", async () => {
    renderLayout(async () => 2);
    const mobileNav = screen.getByRole("navigation", { name: "Portal" });
    expect(await screen.findAllByLabelText("2 por tratar")).toHaveLength(2); // barra de baixo e cabeçalho
    expect(mobileNav).toHaveTextContent("Mais");
  });

  it("acima de 9 mostra «9+»", async () => {
    renderLayout(async () => 12);
    expect((await screen.findAllByLabelText("12 por tratar"))[0]).toHaveTextContent("9+");
  });

  it("sem nada por tratar, sem número", async () => {
    const pendingCount = vi.fn(async () => 0);
    renderLayout(pendingCount);
    await vi.waitFor(() => expect(pendingCount).toHaveBeenCalled());
    expect(screen.queryByLabelText(/por tratar/)).toBeNull();
  });
});
