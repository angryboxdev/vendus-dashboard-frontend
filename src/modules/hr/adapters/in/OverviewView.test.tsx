import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import type { HrOverview, OverviewAlert } from "../../domain/entities/overview.ts";
import type { HrApiPort } from "../../domain/ports/out/hr-api.port.ts";
import { HrProvider, type HrModule } from "../../hr.module.tsx";
import { SetEmployeeKioskPinUseCase } from "../../application/use-cases/set-employee-kiosk-pin.use-case.ts";
import { OverviewView } from "./OverviewView.tsx";

// Dados fictícios (RGPD).
function alert(i: number): OverviewAlert {
  return {
    alertType: "late",
    entityId: `s${i}`,
    severity: "ALTA",
    occurredAt: "2026-10-06T09:00:00Z",
    employeeId: `e${i}`,
    employeeName: `Colaborador ${i}`,
    message: `Alerta ${i}`,
  };
}

function overview(overrides: Partial<HrOverview> = {}): HrOverview {
  return {
    generatedAt: "2026-10-06T09:30:00Z",
    scope: { organizationId: "org", locationId: null },
    team: { status: "ok", data: { activeEmployees: 12, admissionsThisMonth: 0, incompleteProfiles: 3, documentsExpiringSoon: 1, missingDocumentsCount: 0 } },
    today: { status: "ok", data: { scheduledCount: 8, presentCount: 6, lateCount: 2, absentCount: 0 } },
    pending: { status: "ok", data: { shiftsToReviewCount: 0, unpaidPaymentsCount: 0 } },
    alerts: { status: "ok", data: [alert(1), alert(2), alert(3)] },
    operation: { status: "ok", data: [] },
    ...overrides,
  };
}

function renderView(data: HrOverview) {
  const api = { getOverview: async () => data } as unknown as HrApiPort;
  const mod: HrModule = { api, setEmployeeKioskPin: new SetEmployeeKioskPinUseCase(api) };
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <HrProvider module={mod}>
          <OverviewView />
        </HrProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const labelsIn = (group: HTMLElement) => within(group).getAllByText(/./, { selector: "p.text-xs" }).map((p) => p.textContent);

describe("OverviewView — KPIs reorganizados e alertas", () => {
  it("10 KPIs em 3 grupos: Equipa (2), Operação hoje (4), Pendências (4) — testes 1 e 2", async () => {
    renderView(overview());
    const equipa = await screen.findByRole("region", { name: "Equipa" });
    expect(labelsIn(equipa)).toEqual(["Funcionários ativos", "Admissões este mês"]);
    expect(labelsIn(screen.getByRole("region", { name: "Operação hoje" }))).toEqual(["Escalados hoje", "Presentes agora", "Atrasos hoje", "Ausentes hoje"]);
    expect(labelsIn(screen.getByRole("region", { name: "Pendências" }))).toEqual([
      "Dados incompletos",
      "Documentos em falta",
      "Documentos a expirar",
      "Turnos por conferir",
    ]);
  });

  it("títulos centrados; valores 0 visíveis e neutros, cor só quando há ocorrência — testes 3, 5", async () => {
    renderView(overview());
    const pendencias = await screen.findByRole("region", { name: "Pendências" });
    expect(within(pendencias).getByRole("heading", { name: "Pendências" })).toHaveClass("text-center");

    const value = (group: string, label: string) => within(screen.getByRole("region", { name: group })).getByText(label).nextElementSibling!;
    expect(value("Pendências", "Turnos por conferir")).toHaveTextContent("0");
    expect(value("Pendências", "Turnos por conferir")).toHaveClass("text-stone-800");
    expect(value("Pendências", "Documentos em falta")).toHaveClass("text-stone-800");
    expect(value("Pendências", "Dados incompletos")).toHaveClass("text-amber-600");
    expect(value("Operação hoje", "Atrasos hoje")).toHaveClass("text-amber-600");
    expect(value("Operação hoje", "Ausentes hoje")).toHaveClass("text-stone-800");
    expect(value("Equipa", "Funcionários ativos")).toHaveClass("text-emerald-600");
  });

  it("alertas sobem em sequência, na ordem recebida, recortados dentro do painel — testes 7, 8, 10", async () => {
    renderView(overview({ alerts: { status: "ok", data: Array.from({ length: 12 }, (_, i) => alert(i + 1)) } }));
    const items = await screen.findAllByRole("listitem");
    expect(items).toHaveLength(12); // todos renderizados, na ordem do backend
    items.forEach((li, i) => expect(li).toHaveTextContent(`Alerta ${i + 1}`));
    expect(items[0]).toHaveClass("motion-safe:animate-motion-rise");
    expect(items.slice(0, 3).map((li) => li.style.animationDelay)).toEqual(["200ms", "280ms", "360ms"]);

    const list = items[0]!.parentElement!;
    expect(list).toHaveClass("overflow-hidden"); // nada sai do painel durante a subida
    expect(list.parentElement).toHaveClass("max-h-80", "overflow-y-auto"); // muitos alertas → scroll, painel não cresce
  });
});
