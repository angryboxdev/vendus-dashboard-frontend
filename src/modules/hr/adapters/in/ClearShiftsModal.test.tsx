import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ClearWorkShiftsPreview } from "../../domain/entities/schedule.ts";
import type { HrApiPort } from "../../domain/ports/out/hr-api.port.ts";
import { HrProvider, type HrModule } from "../../hr.module.tsx";
import { SetEmployeeKioskPinUseCase } from "../../application/use-cases/set-employee-kiosk-pin.use-case.ts";
import { ClearShiftsModal } from "./ClearShiftsModal.tsx";

// Dados fictícios (RGPD).
const EMPLOYEES = [
  { id: "e1", fullName: "Ana Teste" },
  { id: "e2", fullName: "Bruno Exemplo" },
  { id: "e3", fullName: "Carla Demo" },
];

const PREVIEW: ClearWorkShiftsPreview = {
  deletableCount: 24,
  protectedCount: 1,
  byEmployee: [
    { employeeId: "e1", deletableCount: 12, protectedCount: 1, firstDate: "2026-10-05", lastDate: "2026-12-21" },
    { employeeId: "e2", deletableCount: 12, protectedCount: 0, firstDate: "2026-10-05", lastDate: "2026-12-21" },
  ],
};

function renderModal(employeeId: string | null = "e1") {
  const api = {
    listShiftAutomations: async () => [],
    listShiftTemplates: async () => [],
    previewClearWorkShifts: vi.fn(async () => PREVIEW),
    clearWorkShifts: vi.fn(async () => ({ deletedCount: 24, skipped: [] })),
  } as unknown as HrApiPort;
  const onCleared = vi.fn();
  const mod: HrModule = { api, setEmployeeKioskPin: new SetEmployeeKioskPinUseCase(api) };
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <HrProvider module={mod}>
        <ClearShiftsModal
          employeeId={employeeId}
          employeeName="Ana Teste"
          employees={EMPLOYEES}
          defaultWeekStartDate="2026-10-05"
          onClose={() => {}}
          onCleared={onCleared}
        />
      </HrProvider>
    </QueryClientProvider>,
  );
  return { api, onCleared };
}

describe("ClearShiftsModal — Período (apagar em massa)", () => {
  it("vários colaboradores: pré-visualiza por colaborador e só depois apaga, com confirmação", async () => {
    const { api, onCleared } = renderModal("e1");
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Período" }));
    fireEvent.change(screen.getByLabelText("Até"), { target: { value: "2026-12-27" } });
    await user.click(screen.getByLabelText("Bruno Exemplo"));
    await user.click(screen.getByLabelText("Só rascunhos (os turnos publicados ficam)"));
    await user.click(screen.getByRole("button", { name: "Pré-visualizar" }));

    const scope = { kind: "range", from: "2026-10-05", to: "2026-12-27", employeeIds: ["e1", "e2"], onlyDrafts: true };
    expect(api.previewClearWorkShifts).toHaveBeenCalledWith(scope);
    expect(await screen.findByText("Vão ser apagados 24 turno(s) de 2 colaborador(es).")).toBeInTheDocument();
    expect(screen.getByText("1 turno(s) com presença registada ficam preservados.")).toBeInTheDocument();
    expect(api.clearWorkShifts).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Apagar 24 turno(s)" }));
    await user.click(screen.getByRole("button", { name: "Sim, limpar permanentemente" }));
    expect(api.clearWorkShifts).toHaveBeenCalledWith(scope);
    expect(onCleared).toHaveBeenCalled();
  });

  it("alterar os critérios depois da pré-visualização obriga a pré-visualizar de novo", async () => {
    const { api } = renderModal(null);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Período" }));
    expect(screen.getByLabelText("Todos os colaboradores")).toBeChecked();
    await user.click(screen.getByRole("button", { name: "Pré-visualizar" }));
    expect(api.previewClearWorkShifts).toHaveBeenCalledWith({ kind: "range", from: "2026-10-05", to: "2026-10-11" });
    await screen.findByRole("button", { name: "Apagar 24 turno(s)" });

    fireEvent.change(screen.getByLabelText("Até"), { target: { value: "2026-10-31" } });
    expect(screen.getByRole("button", { name: "Pré-visualizar" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Apagar/ })).not.toBeInTheDocument();
  });
});
