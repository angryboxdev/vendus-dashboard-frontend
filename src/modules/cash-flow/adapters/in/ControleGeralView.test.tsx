import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { CashFlowProvider, type CashFlowModule } from "../../cash-flow.module.tsx";
import { sampleDre, sampleDreEntries, sampleRestaurantSales } from "../../domain/services/dre-fixtures.ts";
import { sampleReport } from "../../domain/services/fixtures.ts";
import { sampleParameters, sampleReconciliation } from "../../domain/services/sales-reconciliation-fixtures.ts";
import { ControleGeralView } from "./ControleGeralView.tsx";

const auth = vi.hoisted(() => ({ permissions: { "dre.statement": "READ", "finance.banking": "READ" } as Record<string, string> }));
vi.mock("../../../../contexts/AuthContext", () => ({
  useOptionalAuth: () => ({ user: { access: { portalOnly: false, isAdmin: false, permissions: auth.permissions } } }),
}));

// O jsdom não tem ResizeObserver (usado pelo ResponsiveContainer do recharts).
beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

const fakeModule = (): CashFlowModule => ({
  getCashFlow: { execute: async () => sampleReport() },
  getToHandle: { execute: async () => null },
  getDre: { execute: async () => sampleDre() },
  getDreRestaurantSales: { execute: async () => sampleRestaurantSales() },
  getDreEntries: { execute: async () => sampleDreEntries() },
  getSalesReconciliation: { execute: async () => sampleReconciliation() },
  getDreParameters: { execute: async () => sampleParameters() },
  saveDreParameters: { execute: async () => sampleParameters() },
});

function renderView() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <CashFlowProvider module={fakeModule()}>
          <ControleGeralView year={2026} month={3} />
        </CashFlowProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("ControleGeralView", () => {
  it("mostra os grupos, o IVA e o resumo; um grupo com pagamentos abre a lista como na DRE", async () => {
    renderView();
    expect(await screen.findByText("Despesas por grupo")).toBeInTheDocument();
    expect(screen.getByText("Despesa colaborador")).toBeInTheDocument();
    expect(screen.getByText("Faturação (com IVA)")).toBeInTheDocument();
    expect(screen.getByText("IVA a reduzir (dedutível)")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "← Voltar à DRE" })).toHaveAttribute("href", "/dre/demonstrativo");

    await userEvent.click(await screen.findByRole("button", { name: "Ver pagamentos — DC Despesa colaborador" }));
    expect(await screen.findByRole("dialog", { name: /DC — Despesa colaborador/ })).toBeInTheDocument();
  });

  it("sem acesso aos bancos: os grupos não abrem pagamentos", async () => {
    auth.permissions = { "dre.statement": "READ" };
    renderView();
    expect(await screen.findByText("Despesa colaborador")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Ver pagamentos/ })).toBeNull();
    auth.permissions = { "dre.statement": "READ", "finance.banking": "READ" };
  });
});
