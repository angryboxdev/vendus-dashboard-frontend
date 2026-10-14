import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../../../../../i18n/I18nProvider.tsx";
import type { OperationalSnapshot } from "../../../domain/entities/dashboard.ts";
import { defaultLayout } from "../../../domain/services/dashboard.service.ts";
import { fakeNovoRhModule } from "../../../fake-module.test-utils.ts";
import { NovoRhProvider } from "../../../novo-rh.module.tsx";
import { NovoRhLayout } from "../NovoRhLayout.tsx";
import { DashboardView } from "./DashboardView.tsx";

// Dados fictícios (RGPD).
const SNAP: OperationalSnapshot = {
  generatedAt: "2026-10-14T10:00:00Z",
  context: { type: "organization", locationId: null, name: null },
  localDate: "2026-10-14",
  tomorrow: "2026-10-15",
  units: { operational: 2, requiringAttention: 0 },
  team: { total: 5, working: 3, remote: 0, break: 0, finished: 1, not_started: 1, vacation: 0, absent: 0, late: 0, missing: 0 },
  coverage: { uncoveredToday: 0, uncoveredTomorrow: 0, uncoveredTotal: 0 },
  requests: { pending: 1, decidable: 1 },
  attention: [],
  locations: [],
  holidays: [],
};

describe("Visão geral — pedidos ao abrir (perf)", () => {
  it("um snapshot para os widgets críticos; Pedidos (barra) e Solicitações (widget) partilham um só pedido; nada duplicado", async () => {
    const m = fakeNovoRhModule();
    m.dashboard.snapshot = vi.fn(async () => SNAP);
    m.dashboard.layout = vi.fn(async () => ({ layoutVersion: 1, widgets: defaultLayout(), custom: false }));
    m.inbox.list = vi.fn(async () => ({ types: [], counters: {}, items: [] }));
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <I18nProvider locale="pt-PT">
        <QueryClientProvider client={qc}>
          <NovoRhProvider module={m}>
            <MemoryRouter initialEntries={["/hr/novo"]}>
              <NovoRhLayout>
                <DashboardView />
              </NovoRhLayout>
            </MemoryRouter>
          </NovoRhProvider>
        </QueryClientProvider>
      </I18nProvider>,
    );
    await screen.findByRole("img", { name: "5 colaboradores" });
    await new Promise((r) => setTimeout(r, 50));
    expect(m.dashboard.snapshot).toHaveBeenCalledTimes(1);
    expect(m.dashboard.layout).toHaveBeenCalledTimes(1);
    expect(m.inbox.list).toHaveBeenCalledTimes(1);
    expect(m.dashboard.team).not.toHaveBeenCalled(); // listas só ao clicar
    expect(m.dashboard.googleLocationReviews).not.toHaveBeenCalled(); // avaliações completas só a pedido
  });
});
