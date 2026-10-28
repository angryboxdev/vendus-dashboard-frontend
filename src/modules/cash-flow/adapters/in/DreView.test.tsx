import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { CashFlowProvider, type CashFlowModule } from "../../cash-flow.module.tsx";
import type { DreReport, DreRestaurantSales } from "../../domain/entities/dre.ts";
import { sampleDre, sampleRestaurantSales, sampleDreEntries } from "../../domain/services/dre-fixtures.ts";
import { sampleParameters, sampleReconciliation } from "../../domain/services/sales-reconciliation-fixtures.ts";
import { sampleReport } from "../../domain/services/fixtures.ts";
import { DreView } from "./DreView.tsx";

const auth = vi.hoisted(() => ({ permissions: { "dre.statement": "MANAGE" } as Record<string, string> }));
vi.mock("../../../../contexts/AuthContext", () => ({
  useOptionalAuth: () => ({ user: { access: { portalOnly: false, isAdmin: false, permissions: auth.permissions } } }),
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

function fakeModule(costs: () => Promise<DreReport> = async () => sampleDre(), sales: () => Promise<DreRestaurantSales> = async () => sampleRestaurantSales()): CashFlowModule {
  return {
    getCashFlow: { execute: async () => sampleReport() },
    getToHandle: { execute: async () => null },
    getDre: { execute: costs },
    getDreRestaurantSales: { execute: sales },
    getDreEntries: { execute: async () => sampleDreEntries() },
    getSalesReconciliation: { execute: async () => sampleReconciliation() },
    getDreParameters: { execute: async () => sampleParameters() },
    saveDreParameters: { execute: async () => sampleParameters() },
  };
}

const deferred = <T,>(value: T) => {
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  return { run: async () => (await gate, value), release };
};

describe("DreView", () => {
  it("DRE em cascata até ao lucro líquido, com % da receita líquida e IVA", async () => {
    renderView(fakeModule());
    expect((await screen.findAllByText(/Lucro líquido da operação/)).length).toBeGreaterThan(1);
    for (const label of ["Receita bruta", "Comissões do TPA", "Receita líquida", "CMV", "Lucro bruto", "Margem de contribuição", "Pessoal", "Resultado operacional"]) {
      expect(screen.getAllByText(new RegExp(label)).length).toBeGreaterThan(0);
    }
    expect(screen.getByText("Outros gastos pelo extrato", { exact: false })).toBeInTheDocument();
    expect((await screen.findAllByText(/3530,02/)).length).toBeGreaterThan(0); // lucro líquido
    expect(screen.getByText("Margem")).toBeInTheDocument();
    expect(screen.getByText(/481,43/)).toBeInTheDocument(); // IVA a entregar
    expect(screen.getByText("90%")).toBeInTheDocument();
  });

  it("abre o detalhe de uma linha (vendas por cartão/dinheiro, categorias)", async () => {
    renderView(fakeModule());
    await userEvent.click(await screen.findByRole("button", { name: /Vendas do restaurante/ }));
    expect(screen.getByText("Venda restaurante cartão")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Pessoal/ }));
    expect(screen.getByText("Salários")).toBeInTheDocument();
  });

  it("custos primeiro: aparecem logo e avisa que as vendas estão a carregar (mais demorado na 1.ª vez do mês)", async () => {
    const sales = deferred(sampleRestaurantSales());
    renderView(fakeModule(undefined, sales.run));
    expect(await screen.findByText("As vendas do restaurante estão a carregar")).toBeInTheDocument();
    expect(screen.getByText(/primeira vez que abre este mês/)).toBeInTheDocument();
    expect(await screen.findByText(/1200,00/)).toBeInTheDocument(); // Pessoal já à vista
    expect(screen.queryByText(/3530,02/)).toBeNull();

    sales.release();
    expect((await screen.findAllByText(/3530,02/)).length).toBeGreaterThan(0);
    expect(screen.queryByText("As vendas do restaurante estão a carregar")).toBeNull();
  });

  it("vendas primeiro: aparecem logo mesmo com os custos ainda a carregar", async () => {
    const costs = deferred(sampleDre());
    renderView(fakeModule(costs.run));
    expect(await screen.findByText("Os custos do banco estão a carregar")).toBeInTheDocument();
    expect(await screen.findByText(/5000,00/)).toBeInTheDocument(); // vendas do restaurante
    expect(screen.queryByText(/3530,02/)).toBeNull();

    costs.release();
    expect((await screen.findAllByText(/3530,02/)).length).toBeGreaterThan(0);
  });

  it("mês futuro: não pede nada", () => {
    let called = false;
    renderView(fakeModule(async () => ((called = true), sampleDre())), 2099, 1);
    expect(screen.getByText("Este mês ainda não começou")).toBeInTheDocument();
    expect(called).toBe(false);
  });

  it("com Bancos: cada rubrica abre a lista dos seus pagamentos, por categoria, com a data da fatura", async () => {
    auth.permissions = { "dre.statement": "READ", "finance.banking": "READ" };
    renderView(fakeModule());
    await userEvent.click(await screen.findByRole("button", { name: "Ver pagamentos — Pessoal" }));
    expect(await screen.findByRole("region", { name: "Salários" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Encargos" })).toBeInTheDocument();
    expect(screen.getByText("Salários · março")).toBeInTheDocument();
    expect(screen.getByText(/Pago a 02\/04\/2026 · fatura de 31\/03\/2026/)).toBeInTheDocument();
    // só os pagamentos desta linha (o CMV não aparece)
    expect(screen.queryByText("Fornecedor Teste · FT 1")).toBeNull();
    auth.permissions = { "dre.statement": "MANAGE" };
  });

  it("sem Bancos: não há botão de pagamentos", async () => {
    renderView(fakeModule());
    expect((await screen.findAllByText(/Pessoal/)).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /Ver pagamentos/ })).toBeNull();
  });
});
