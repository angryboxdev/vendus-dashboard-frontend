import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type {
  OccurrenceDecision,
  ShiftTemplate,
  TemplateApplicationConfig,
  TemplateApplicationPreview,
  TemplateOccurrence,
} from "../../domain/entities/shift-template.ts";
import type { HrApiPort } from "../../domain/ports/out/hr-api.port.ts";
import { HrProvider, type HrModule } from "../../hr.module.tsx";
import { SetEmployeeKioskPinUseCase } from "../../application/use-cases/set-employee-kiosk-pin.use-case.ts";
import { ApplyTemplateModal } from "./ApplyTemplateModal.tsx";

const locationsState = vi.hoisted(() => ({ locations: [{ id: "loc-mbs", name: "MBS", isActive: true }] }));
vi.mock("../../../locations/adapters/in/use-locations.ts", () => ({ useLocations: () => locationsState }));

const TEMPLATE: ShiftTemplate = {
  id: "tpl-1",
  name: "Manhã 1",
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

// Dados fictícios (RGPD).
function occurrence(key: string, name: string, overrides: Partial<TemplateOccurrence> = {}): TemplateOccurrence {
  return {
    key,
    employeeId: key.split("|")[0]!,
    employeeName: name,
    positionId: "pos-prep",
    workDate: key.split("|")[1]!,
    startTime: "08:00",
    endTime: "16:00",
    secondStartTime: null,
    secondEndTime: null,
    endsNextDay: false,
    locationId: "loc-mbs",
    status: "valid",
    holidayName: null,
    existingShift: null,
    existingHasAttendance: false,
    ...overrides,
  };
}

const PREVIEW: TemplateApplicationPreview = {
  occurrences: [
    occurrence("e1|2026-11-07", "Carlos Andrés"),
    occurrence("e2|2026-11-07", "Gabriel Silva", {
      status: "overlap",
      existingShift: { id: "s-old", startTime: "09:00", endTime: "17:00", secondStartTime: null, secondEndTime: null, locationId: "loc-mbs" },
    }),
    occurrence("e3|2026-11-08", "Ana Martins", { status: "leave" }),
  ],
  summary: { employees: 3, valid: 1, duplicate: 0, overlap: 1, unavailable: 1, inactive: 0, holidays: 0 },
};

function renderModal() {
  const calls: { config: TemplateApplicationConfig; decisions?: Record<string, OccurrenceDecision> }[] = [];
  const api = {
    listEmployees: async () => ({ items: [], total: 0, page: 1, pageSize: 100 }),
    listPositions: async () => [{ id: "pos-prep", name: "Preparador", description: null, active: true, employeeCount: 3, updatedAt: "" }],
    previewTemplateApplication: async (_id: string, config: TemplateApplicationConfig) => {
      calls.push({ config });
      return PREVIEW;
    },
    applyTemplate: async (_id: string, config: TemplateApplicationConfig, decisions: Record<string, OccurrenceDecision>) => {
      calls.push({ config, decisions });
      return { created: 1, replaced: 1, skipped: 1, changed: [] };
    },
  } as unknown as HrApiPort;
  const mod: HrModule = { api, setEmployeeKioskPin: new SetEmployeeKioskPinUseCase(api) };
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <HrProvider module={mod}>
        <ApplyTemplateModal templates={[TEMPLATE]} initialTemplateId="tpl-1" onClose={() => {}} />
      </HrProvider>
    </QueryClientProvider>,
  );
  return calls;
}

describe("ApplyTemplateModal", () => {
  it("configura por cargo + fins de semana, resolve o conflito com Substituir e confirma", async () => {
    const calls = renderModal();
    const user = userEvent.setup();
    const dialog = screen.getByRole("dialog", { name: "Aplicar modelo de turno" });

    await user.click(within(dialog).getByLabelText("Por cargo"));
    await user.selectOptions(await within(dialog).findByRole("combobox", { name: "Cargo" }), "pos-prep");
    await user.click(within(dialog).getByLabelText("Fins de semana"));
    fireEvent.change(within(dialog).getByLabelText("De"), { target: { value: "2026-11-01" } });
    fireEvent.change(within(dialog).getByLabelText("Até"), { target: { value: "2026-11-30" } });
    await user.click(within(dialog).getByRole("button", { name: "Pré-visualizar" }));

    expect(await within(dialog).findByText("Conflito de horário", { selector: "span" })).toBeInTheDocument();
    expect(within(dialog).getByText("Colaborador indisponível", { selector: "span" })).toBeInTheDocument();
    expect(calls[0]!.config).toEqual({
      audience: { kind: "position", positionId: "pos-prep", locationId: null },
      days: { kind: "range", from: "2026-11-01", to: "2026-11-30", weekdays: [5, 6] },
      locationId: null,
    });

    await user.click(within(dialog).getByRole("button", { name: "Resolver" }));
    await user.click(within(dialog).getByLabelText("Substituir turno existente"));
    await user.click(within(dialog).getByRole("button", { name: "Continuar" }));
    await user.click(within(dialog).getByRole("button", { name: "Criar 2 turno(s)" }));

    expect(await within(dialog).findByText(/1 turno\(s\) criado\(s\), 1 substituído\(s\)/)).toBeInTheDocument();
    expect(calls[1]!.decisions).toEqual({
      "e1|2026-11-07": { action: "create" },
      "e2|2026-11-07": { action: "replace", existingShiftId: "s-old" },
      "e3|2026-11-08": { action: "skip" },
    });
  });

  it("não pré-visualiza sem colaborador escolhido", async () => {
    renderModal();
    const user = userEvent.setup();
    const dialog = screen.getByRole("dialog", { name: "Aplicar modelo de turno" });
    await user.click(within(dialog).getByRole("button", { name: "Pré-visualizar" }));
    expect(within(dialog).getByText("Escolha pelo menos um colaborador.")).toBeInTheDocument();
  });
});
