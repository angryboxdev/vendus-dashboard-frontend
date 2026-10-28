import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { CashFlowProvider, type CashFlowModule } from "../../cash-flow.module.tsx";
import { sampleDre, sampleRestaurantSales } from "../../domain/services/dre-fixtures.ts";
import { sampleReport } from "../../domain/services/fixtures.ts";
import { sampleParameters, sampleReconciliation } from "../../domain/services/sales-reconciliation-fixtures.ts";
import { SalesReconciliationView } from "./SalesReconciliationView.tsx";

const fakeModule = (): CashFlowModule => ({
  getCashFlow: { execute: async () => sampleReport() },
  getToHandle: { execute: async () => null },
  getDre: { execute: async () => sampleDre() },
  getDreRestaurantSales: { execute: async () => sampleRestaurantSales() },
  getDreEntries: { execute: async () => null },
  getSalesReconciliation: { execute: async () => sampleReconciliation() },
  getDreParameters: { execute: async () => sampleParameters() },
  saveDreParameters: { execute: async () => sampleParameters() },
});

function renderView(mod: CashFlowModule, year = 2026, month = 9) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <CashFlowProvider module={mod}>
          <SalesReconciliationView year={year} month={month} />
        </CashFlowProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("SalesReconciliationView", () => {
  it("mostra cartão × TPA (liquidações, taxa, por liquidar) e numerário × depósitos", async () => {
    renderView(fakeModule());
    expect(await screen.findByText(/Venda restaurante cartão/)).toBeInTheDocument();
    expect(screen.getByText("04/09 – 06/09")).toBeInTheDocument();
    expect(screen.getByText("Taxa OK")).toBeInTheDocument();
    expect(screen.getByText("Verificar")).toBeInTheDocument();
    expect(screen.getByText("1,5%")).toBeInTheDocument();
    expect(screen.getByText(/ainda sem crédito TPA/)).toBeInTheDocument();
    expect(screen.getByText(/Venda restaurante dinheiro/)).toBeInTheDocument();
    expect(screen.getByText("Por depositar")).toBeInTheDocument();
  });

  it("mês futuro: não pede nada", () => {
    let called = false;
    renderView({ ...fakeModule(), getSalesReconciliation: { execute: async () => ((called = true), sampleReconciliation()) } }, 2099, 1);
    expect(screen.getByText("Este mês ainda não começou")).toBeInTheDocument();
    expect(called).toBe(false);
  });
});
