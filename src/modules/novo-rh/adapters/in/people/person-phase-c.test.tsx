import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { Balance } from "../../../domain/entities/absences.ts";
import type { TimeBankLedger } from "../../../domain/entities/time-bank.ts";
import { balanceUsage } from "../../../domain/services/absences.service.ts";
import { fakeNovoRhModule } from "../../../fake-module.test-utils.ts";
import { NovoRhProvider, type NovoRhModule } from "../../../novo-rh.module.tsx";
import { BalancesPanel, RequestsPanel } from "../absences/RequestPanels.tsx";
import { LedgerPanel } from "../time-bank/TimeBankView.tsx";
import { DocumentsTab } from "./PersonTabs.tsx";

function renderWith(ui: ReactNode, m: NovoRhModule) {
  render(
    <MemoryRouter>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <NovoRhProvider module={m} modeStore={{ load: () => "real", save: () => {} }}>
          {ui}
        </NovoRhProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

const mod = () => fakeNovoRhModule({ settings: { listEmployees: vi.fn(async () => []) } as unknown as NovoRhModule["settings"] });

const FERIAS: Balance = { typeId: "t1", typeName: "Férias", unit: "days", limited: true, period: "2026", accrued: 22, used: 11, adjusted: 0, balance: 11, pending: 5.5, available: 5.5, entries: [] };

describe("Ausências na ficha (Fase C)", () => {
  it("balanceUsage: gozado e pendente face ao direito; sem limite ou sem direito não há barra", () => {
    expect(balanceUsage(FERIAS)).toEqual({ used: 0.5, pending: 0.25 });
    expect(balanceUsage({ ...FERIAS, limited: false })).toBeNull();
    expect(balanceUsage({ ...FERIAS, accrued: 0 })).toBeNull();
    expect(balanceUsage({ ...FERIAS, used: 30 })).toEqual({ used: 1, pending: 0 });
  });

  it("saldos em cartões: disponível em destaque, barra e gozado/pendente", async () => {
    const m = mod();
    m.absences.balances = vi.fn(async () => [FERIAS, { ...FERIAS, typeId: "t2", typeName: "Formação", limited: false }]);
    renderWith(<BalancesPanel fixedEmployeeId="e1" />, m);
    expect(await screen.findByText("5,5 dias")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Gozado 11 dias, pendente 5,5 dias" })).toBeInTheDocument();
    expect(screen.getByText("Sem limite")).toBeInTheDocument();
  });

  it("na ficha, os pedidos abrem com «Todos» (histórico da pessoa)", async () => {
    const m = mod();
    m.absences.listRequests = vi.fn(async () => []);
    m.absences.listTypes = vi.fn(async () => []);
    renderWith(<RequestsPanel fixedEmployeeId="e1" />, m);
    await screen.findByText(/Sem pedidos|Nenhum pedido|sem pedidos/i);
    expect(m.absences.listRequests).toHaveBeenCalledWith({ employeeId: "e1" });
    expect((screen.getByRole("combobox", { name: "Estado" }) as HTMLSelectElement).selectedOptions[0]!.textContent).toBe("Todos");
  });
});

describe("Banco de horas na ficha (Fase C)", () => {
  const LEDGER: TimeBankLedger = { employeeId: "e1", cutoff: "2026-10-17", today: "2026-10-18", balance: -3600, available: 0, compensateBeyondBalance: false, generated: 0, compensatedRest: 0, compensatedPaid: 0, expired: 0, pendingValidation: [], entries: [] };

  it("«Sincronizar» fica desativado enquanto a abertura (que já sincroniza) está em curso", async () => {
    const m = mod();
    let release!: (l: TimeBankLedger) => void;
    m.timeBank.ledger = vi.fn(() => new Promise<TimeBankLedger>((r) => (release = r)));
    renderWith(<LedgerPanel fixedEmployeeId="e1" />, m);
    const btn = await screen.findByRole("button", { name: "Sincronizar" });
    expect(btn).toBeDisabled();
    release(LEDGER);
    await vi.waitFor(() => expect(screen.getByRole("button", { name: "Sincronizar" })).toBeEnabled());
    // Saldo negativo a vermelho; sem movimentos → estado vazio.
    expect(screen.getByText("-1h00m00s")).toHaveClass("text-red-700");
    expect(screen.getByText("Ainda sem movimentos.")).toBeInTheDocument();
  });
});

describe("Documentos recebidos (Fase C)", () => {
  it("estado de leitura como selo", async () => {
    const m = mod();
    m.distributions.forEmployee = vi.fn(async () => [
      { id: "d1", title: "Regulamento interno", createdAt: "2026-10-01T10:00:00Z", readAt: "2026-10-02T10:00:00Z", confirmedAt: "2026-10-02T10:05:00Z" },
      { id: "d2", title: "Escala de Natal", createdAt: "2026-10-10T10:00:00Z", readAt: null, confirmedAt: null },
    ] as never);
    renderWith(<DocumentsTab personId="e1" />, m);
    const list = await screen.findByRole("region", { name: "Documentos enviados pela empresa" });
    const r1 = (await within(list).findByText("Regulamento interno")).closest("li")!;
    const r2 = within(list).getByText("Escala de Natal").closest("li")!;
    expect(within(r1).getByText(/Confirmad/)).toBeInTheDocument();
    expect(within(r2).getByText(/Entregue/)).toBeInTheDocument();
  });
});
