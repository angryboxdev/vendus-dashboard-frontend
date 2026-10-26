import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeAll, describe, expect, it } from "vitest";
import { CashFlowProvider, type CashFlowModule } from "../../cash-flow.module.tsx";
import { sampleReport } from "../../domain/services/fixtures.ts";
import { CashFlowView } from "./CashFlowView.tsx";

// O jsdom não tem ResizeObserver (usado pelo ResponsiveContainer do recharts).
beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

function renderView(mod: CashFlowModule, year = 2026, month = 3) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <CashFlowProvider module={mod}>
          <CashFlowView year={year} month={month} />
        </CashFlowProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const fakeModule = (): CashFlowModule => ({ getCashFlow: { execute: async () => sampleReport() } });

describe("CashFlowView", () => {
  it("mostra resultado, justificação, entradas por tipo e as 3 maiores categorias", async () => {
    renderView(fakeModule());

    expect(await screen.findByText("Resultado")).toBeInTheDocument();
    expect(screen.getByText(/1100,00/)).toBeInTheDocument();
    expect(screen.getByText("81%")).toBeInTheDocument();
    expect(screen.getByText("2 saídas por tratar")).toBeInTheDocument();
    expect(screen.getByText("Vendas e recebimentos")).toBeInTheDocument();

    const categories = screen.getByRole("heading", { name: "Despesas por categoria" }).closest("section")!;
    expect(within(categories).getByText("Pessoal")).toBeInTheDocument();
    expect(within(categories).getByText("Transferência enviada")).toBeInTheDocument();
    expect(within(categories).getByText("Por classificar")).toBeInTheDocument();
    expect(within(categories).queryByText("Estrutura & Instalações")).not.toBeInTheDocument();

    await userEvent.click(within(categories).getByRole("button", { name: /Ver mais 1/ }));
    expect(within(categories).getByText("Estrutura & Instalações")).toBeInTheDocument();
  });

  it("abre o detalhe de um grupo (Salários, Encargos)", async () => {
    renderView(fakeModule());
    await userEvent.click(await screen.findByRole("button", { name: /Pessoal/ }));
    expect(screen.getByText("Salários")).toBeInTheDocument();
    expect(screen.getByText("Encargos")).toBeInTheDocument();
  });

  it("mês futuro: não pede nada", () => {
    let called = false;
    renderView({ getCashFlow: { execute: async () => ((called = true), sampleReport()) } }, 2099, 1);
    expect(screen.getByText("Este mês ainda não começou")).toBeInTheDocument();
    expect(called).toBe(false);
  });
});
