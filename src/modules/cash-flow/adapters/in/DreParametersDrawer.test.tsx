import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CashFlowProvider, type CashFlowModule } from "../../cash-flow.module.tsx";
import type { DreParameters } from "../../domain/entities/dre.ts";
import { sampleDre, sampleRestaurantSales } from "../../domain/services/dre-fixtures.ts";
import { sampleReport } from "../../domain/services/fixtures.ts";
import { sampleParameters, sampleReconciliation } from "../../domain/services/sales-reconciliation-fixtures.ts";
import { DreParametersDrawer } from "./DreParametersDrawer.tsx";

const auth = vi.hoisted(() => ({ level: "MANAGE" as "READ" | "MANAGE" }));
vi.mock("../../../../contexts/AuthContext", () => ({
  useOptionalAuth: () => ({ user: { access: { portalOnly: false, isAdmin: false, permissions: { "dre.statement": auth.level } } } }),
}));

function renderDrawer(saved: [number, number, DreParameters][], onClose = () => {}) {
  const mod: CashFlowModule = {
    getCashFlow: { execute: async () => sampleReport() },
    getToHandle: { execute: async () => null },
    getDre: { execute: async () => sampleDre() },
    getDreRestaurantSales: { execute: async () => sampleRestaurantSales() },
    getDreEntries: { execute: async () => null },
    getSalesReconciliation: { execute: async () => sampleReconciliation() },
    getDreParameters: { execute: async () => sampleParameters() },
    saveDreParameters: { execute: async (y, m, p) => (saved.push([y, m, p]), { ...p, source: "month" as const }) },
  };
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <CashFlowProvider module={mod}>
        <DreParametersDrawer year={2026} month={9} open onClose={onClose} />
      </CashFlowProvider>
    </QueryClientProvider>,
  );
}

describe("DreParametersDrawer", () => {
  it("grava as taxas e o marketing (euros → cêntimos) e fecha", async () => {
    auth.level = "MANAGE";
    const saved: [number, number, DreParameters][] = [];
    const onClose = vi.fn();
    renderDrawer(saved, onClose);
    expect(await screen.findByText(/Valores de omissão/)).toBeInTheDocument();

    const vat = screen.getByLabelText(/IVA médio das vendas de delivery/);
    await userEvent.clear(vat);
    await userEvent.type(vat, "14,5");
    await userEvent.type(screen.getByLabelText("Uber Eats"), "{selectall}250,40");
    await userEvent.click(screen.getByRole("button", { name: "Gravar" }));

    expect(saved).toHaveLength(1);
    expect(saved[0]![2]).toMatchObject({ deliverySalesVatPct: 14.5, marketingNetCents: { uber_eats: 25_040, glovo: 0, bolt_food: 0 } });
    expect(onClose).toHaveBeenCalled();
  });

  it("valor inválido não grava e avisa", async () => {
    auth.level = "MANAGE";
    const saved: [number, number, DreParameters][] = [];
    renderDrawer(saved);
    const fee = await screen.findByLabelText(/Taxa do TPA/);
    await userEvent.clear(fee);
    await userEvent.type(fee, "abc");
    await userEvent.click(screen.getByRole("button", { name: "Gravar" }));
    expect(screen.getByText("Há valores inválidos")).toBeInTheDocument();
    expect(saved).toHaveLength(0);
  });

  it("só leitura sem permissão de gestão: sem botão Gravar", async () => {
    auth.level = "READ";
    renderDrawer([]);
    expect(await screen.findByText(/Valores de omissão/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Gravar" })).toBeNull();
  });
});
