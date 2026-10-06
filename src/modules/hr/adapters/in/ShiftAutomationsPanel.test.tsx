import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ShiftAutomation, ShiftAutomationPayload } from "../../domain/entities/shift-automation.ts";
import type { ShiftTemplate } from "../../domain/entities/shift-template.ts";
import type { HrApiPort } from "../../domain/ports/out/hr-api.port.ts";
import { HrProvider, type HrModule } from "../../hr.module.tsx";
import { SetEmployeeKioskPinUseCase } from "../../application/use-cases/set-employee-kiosk-pin.use-case.ts";
import { ShiftAutomationsPanel } from "./ShiftAutomationsPanel.tsx";

/** Objetos estáveis entre renders (ver nota no teste de LocationsAdminView). */
const auth = vi.hoisted(() => ({
  value: { user: { id: "u1", email: "gestor@exemplo.pt", role: "manager" as const, organizationId: "org" }, loading: false },
}));
vi.mock("../../../../contexts/AuthContext.tsx", () => ({ useAuth: () => auth.value }));
const locationsState = vi.hoisted(() => ({ locations: [{ id: "loc-mbs", name: "MBS", isActive: true }] }));
vi.mock("../../../locations/adapters/in/use-locations.ts", () => ({ useLocations: () => locationsState }));

const TODAY = new Date().toISOString().slice(0, 10);

const TEMPLATE: ShiftTemplate = {
  id: "tpl-1",
  name: "Manhã 1",
  group: "OPENING",
  description: null,
  color: null,
  kind: "direct",
  startTime: "08:00",
  endTime: "16:00",
  endsNextDay: false,
  secondStartTime: null,
  secondEndTime: null,
  breakMinutes: 0,
  workMinutes: 480,
  spanMinutes: 480,
  locationId: "loc-mbs",
  active: true,
  updatedAt: "",
};

const WEEKENDS: ShiftAutomation = {
  id: "a1",
  name: "Fim de semana — Preparadores",
  description: null,
  kind: "weekly",
  templateId: "tpl-1",
  templateName: "Manhã 1",
  audience: { kind: "position", positionId: "pos-prep" },
  locationId: "loc-mbs",
  weekdays: [5, 6],
  startDate: "2026-11-01",
  endDate: null,
  horizonWeeks: 4,
  status: "active",
  generatedUntil: "2026-11-29",
  lastRunAt: null,
  openIssues: 2,
  updatedAt: "",
};

function renderPanel(seed: ShiftAutomation[] = [WEEKENDS]) {
  let automations = [...seed];
  const created: { payload: ShiftAutomationPayload; generateNow: boolean }[] = [];
  const api = {
    listShiftAutomations: async () => automations,
    listShiftTemplates: async () => [TEMPLATE],
    listPositions: async () => [{ id: "pos-prep", name: "Preparador", description: null, active: true, employeeCount: 2, updatedAt: "" }],
    listEmployees: async () => ({ items: [], total: 0, page: 1, pageSize: 100 }),
    setShiftAutomationStatus: async (id: string, status: "active" | "paused") => {
      automations = automations.map((a) => (a.id === id ? { ...a, status } : a));
      return automations.find((a) => a.id === id)!;
    },
    generateShiftAutomation: vi.fn(async () => ({ automationId: "a1", window: { from: "2026-11-30", to: "2026-12-13" }, created: 4, alreadyExisting: 0, issues: 1 })),
    previewTemplateApplication: async () => ({
      occurrences: [],
      summary: { employees: 0, valid: 0, duplicate: 0, overlap: 0, unavailable: 0, inactive: 0, holidays: 0 },
    }),
    createShiftAutomation: async (payload: ShiftAutomationPayload, generateNow: boolean) => {
      created.push({ payload, generateNow });
      return { automation: { ...WEEKENDS, id: "a2", name: payload.name }, generation: { automationId: "a2", window: null, created: 0, alreadyExisting: 0, issues: 0 } };
    },
  } as unknown as HrApiPort;
  const mod: HrModule = { api, setEmployeeKioskPin: new SetEmployeeKioskPinUseCase(api) };
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <HrProvider module={mod}>
        <ShiftAutomationsPanel />
      </HrProvider>
    </QueryClientProvider>,
  );
  return { api, created };
}

describe("ShiftAutomationsPanel", () => {
  it("lista com público, quando, recorrência, estado e ocorrências por resolver; pausa", async () => {
    renderPanel();
    const user = userEvent.setup();

    const row = (await screen.findByText("Fim de semana — Preparadores")).closest("tr")!;
    expect(within(row).getByText("Cargo · Preparador")).toBeInTheDocument();
    expect(within(row).getByText("Sáb, Dom")).toBeInTheDocument();
    expect(within(row).getByText("Semanal")).toBeInTheDocument();
    expect(within(row).getByText(/2 por resolver/)).toBeInTheDocument();

    await user.click(within(row).getByRole("button", { name: "Pausar" }));
    expect(await within(row).findByText("Pausada")).toBeInTheDocument();
    expect(within(row).queryByRole("button", { name: /Gerar/ })).not.toBeInTheDocument();
  });

  it("Gerar próximas X semanas mostra o resumo", async () => {
    const { api } = renderPanel();
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Gerar Fim de semana — Preparadores" }));
    const dialog = screen.getByRole("dialog", { name: "Gerar turnos" });
    await user.selectOptions(within(dialog).getByLabelText("Gerar as próximas"), "2");
    await user.click(within(dialog).getByRole("button", { name: "Gerar" }));

    expect(await within(dialog).findByText("4 turno(s) criado(s) · 1 por resolver em Alertas e ações")).toBeInTheDocument();
    expect(api.generateShiftAutomation).toHaveBeenCalledWith("a1", 2);
  });

  it("Nova automatização usa o Aplicar modelo em modo automatização e grava a regra", async () => {
    const { created } = renderPanel([]);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Nova automatização" }));
    const dialog = screen.getByRole("dialog", { name: "Aplicar modelo de turno" });

    expect(within(dialog).getByLabelText("Guardar como automatização")).toBeChecked();
    expect(within(dialog).queryByLabelText("Datas específicas")).not.toBeInTheDocument();
    await user.click(within(dialog).getByLabelText("Por cargo"));
    await user.selectOptions(await within(dialog).findByRole("combobox", { name: "Cargo" }), "pos-prep");
    await user.click(within(dialog).getByLabelText("Fins de semana"));
    fireEvent.change(within(dialog).getByLabelText("De"), { target: { value: TODAY } });
    await user.type(within(dialog).getByLabelText(/Nome da automatização/), "Fim de semana");
    await user.selectOptions(within(dialog).getByLabelText("Horizonte de geração"), "2");
    await user.click(within(dialog).getByRole("button", { name: "Pré-visualizar" }));
    await user.click(await within(dialog).findByRole("button", { name: "Continuar" }));
    await user.click(within(dialog).getByRole("button", { name: "Guardar automatização" }));

    expect(await within(dialog).findByText(/Automatização guardada/)).toBeInTheDocument();
    expect(created).toEqual([
      {
        payload: {
          name: "Fim de semana",
          description: null,
          templateId: "tpl-1",
          audience: { kind: "position", positionId: "pos-prep", locationId: null },
          locationId: null,
          weekdays: [5, 6],
          startDate: TODAY,
          endDate: null,
          horizonWeeks: 2,
        },
        generateNow: true,
      },
    ]);
  });

  it("automatização que começa depois do horizonte é guardada sem pré-visualização (o cron gera depois)", async () => {
    renderPanel([]);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Nova automatização" }));
    const dialog = screen.getByRole("dialog", { name: "Aplicar modelo de turno" });
    await user.click(within(dialog).getByLabelText("Todos"));
    fireEvent.change(within(dialog).getByLabelText("De"), { target: { value: "2099-01-01" } });
    await user.type(within(dialog).getByLabelText(/Nome da automatização/), "Futuro");
    await user.click(within(dialog).getByRole("button", { name: "Pré-visualizar" }));

    expect(await within(dialog).findByText(/os turnos são gerados quando o período entrar no horizonte/)).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Guardar automatização" })).toBeEnabled();
  });
});
