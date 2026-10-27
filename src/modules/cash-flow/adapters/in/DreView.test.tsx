import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { CashFlowProvider, type CashFlowModule } from "../../cash-flow.module.tsx";
import { sampleDre } from "../../domain/services/dre-fixtures.ts";
import { sampleParameters, sampleReconciliation } from "../../domain/services/sales-reconciliation-fixtures.ts";
import { sampleReport } from "../../domain/services/fixtures.ts";
import { DreView } from "./DreView.tsx";

vi.mock("../../../../contexts/AuthContext", () => ({
  useOptionalAuth: () => ({ user: { access: { portalOnly: false, isAdmin: false, permissions: { "dre.statement": "MANAGE" } } } }),
}));

function renderView(mod: CashFlowModule, year = 2026, month = 3) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <CashFlowProvider module={mod}>
          <DreView year={year} month={month} />
        </CashFlowProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const fakeModule = (): CashFlowModule => ({
  getCashFlow: { execute: async () => sampleReport() },
  getToHandle: { execute: async () => null },
  getDre: { execute: async () => sampleDre() },
  getSalesReconciliation: { execute: async () => sampleReconciliation() },
  getDreParameters: { execute: async () => sampleParameters() },
  saveDreParameters: { execute: async () => sampleParameters() },
});

describe("DreView", () => {
  it("mostra receita (restaurante e plataformas), gastos, ajustes, resultado, IVA e confiança", async () => {
    renderView(fakeModule());
    expect(await screen.findByText("Demonstração de resultados")).toBeInTheDocument();
    expect(screen.getByText("Restaurante")).toBeInTheDocument();
    expect(screen.getByText("Venda restaurante cartão")).toBeInTheDocument();
    expect(screen.getByText("Custos das plataformas")).toBeInTheDocument();
    expect(screen.getByText(/margem 569,57/)).toBeInTheDocument();
    expect(screen.getByText(/Venda plataforma Uber Eats/)).toBeInTheDocument();
    expect(screen.getByText("Compra com cartão")).toBeInTheDocument();
    expect(screen.getByText(/IVA por confirmar 100,00/)).toBeInTheDocument();
    expect(screen.getByText("A entregar (estimativa)")).toBeInTheDocument();
    expect(screen.getByText("90%")).toBeInTheDocument();
    expect(screen.getAllByText(/3419,57/).length).toBeGreaterThan(0);
  });

  it("abre o detalhe de um grupo de gastos", async () => {
    renderView(fakeModule());
    await userEvent.click(await screen.findByRole("button", { name: /Pessoal/ }));
    expect(screen.getByText("Salários")).toBeInTheDocument();
  });

  it("mês futuro: não pede nada", () => {
    let called = false;
    renderView({ ...fakeModule(), getDre: { execute: async () => ((called = true), sampleDre()) } }, 2099, 1);
    expect(screen.getByText("Este mês ainda não começou")).toBeInTheDocument();
    expect(called).toBe(false);
  });
});
