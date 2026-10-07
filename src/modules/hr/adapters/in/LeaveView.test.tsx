import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { HrApiPort } from "../../domain/ports/out/hr-api.port.ts";
import type { AbsenceBoard, AbsenceImpact } from "../../domain/entities/absences.ts";
import type { AttendanceIssueDetail } from "../../domain/entities/attendance-conference.ts";
import { HrProvider, type HrModule } from "../../hr.module.tsx";
import { SetEmployeeKioskPinUseCase } from "../../application/use-cases/set-employee-kiosk-pin.use-case.ts";
import { LeaveView } from "./LeaveView.tsx";
import { AttendanceIssueResolutionModal } from "./AttendanceIssueResolutionModal.tsx";

// Dados fictícios (RGPD).
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Lisbon" }).format(new Date());
const BOARD: AbsenceBoard = {
  holidays: [{ date: today, name: "Feriado Teste" }],
  attention: { pendingRequests: 1, pendingDocuments: 0, shiftConflicts: 1 },
  records: [
    {
      id: "a1",
      source: "absence",
      employeeId: "e1",
      employeeName: "CARLA DEMO",
      positionName: "Preparador",
      locationId: "loc-1",
      locationName: "Loja Teste",
      type: "vacation",
      startDate: today,
      endDate: today,
      startTime: null,
      endTime: null,
      duration: "1 dia útil",
      status: "approved",
      affectedShifts: 1,
      notes: null,
      origin: "hr",
      decisionNote: null,
    },
  ],
};
const IMPACT: AbsenceImpact = {
  workingDays: 5,
  duration: "5 dias úteis",
  balance: { defined: true, available: 14, after: 9 },
  affectedShifts: [{ workDate: "2026-10-12", hours: "10:00–18:00" }],
  othersAbsent: ["OUTRO DEMO"],
  overlapsExisting: false,
};

function renderWith(ui: ReactNode, api: Partial<HrApiPort>) {
  const full = {
    getAbsenceBoard: vi.fn(async () => BOARD),
    listEmployees: vi.fn(async () => ({ items: [{ id: "e1", fullName: "CARLA DEMO", photoUrl: null }], total: 1, page: 1, pageSize: 200 })),
    ...api,
  } as unknown as HrApiPort;
  const mod: HrModule = { api: full, setEmployeeKioskPin: new SetEmployeeKioskPinUseCase(full) };
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <MemoryRouter>
      <QueryClientProvider client={qc}>
        <HrProvider module={mod}>{ui}</HrProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
  return full;
}

describe("LeaveView — Férias & Ausências 2.0", () => {
  it("mostra 'Requer atenção' e o registo no calendário e nos Registos", async () => {
    renderWith(<LeaveView />, {});
    const user = userEvent.setup();
    expect(await screen.findByText(/1 pedido aguarda aprovação · 1 conflito em turnos/)).toBeInTheDocument();
    expect(screen.getByText("Carla Demo — Férias")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Registos" }));
    expect(screen.getByText("⚠ 1 turno afetado")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ver →" })).toBeInTheDocument();
  });

  it("Registar ausência: mostra o impacto e envia", async () => {
    const previewAbsence = vi.fn(async () => IMPACT);
    const registerAbsence = vi.fn(async () => ({ id: "new" }));
    renderWith(<LeaveView />, { previewAbsence, registerAbsence });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "+ Registar ausência" }));
    await user.selectOptions(screen.getByLabelText("Colaborador"), "e1");
    await user.type(screen.getByLabelText("Início"), "2026-10-12");
    await user.type(screen.getByLabelText("Fim"), "2026-10-16");
    expect(await screen.findByText("9 dias disponíveis")).toBeInTheDocument();
    expect(screen.getByText("1 outro colaborador ausente")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Registar ausência" }));
    expect(registerAbsence).toHaveBeenCalledWith(expect.objectContaining({ employeeId: "e1", type: "vacation", duration: "day", startDate: "2026-10-12", endDate: "2026-10-16" }));
  });
});

describe("LeaveView — Saldos", () => {
  it("lista saldos, marca o sugerido e guarda a alteração", async () => {
    const setLeaveBalance = vi.fn(async () => undefined);
    const listLeaveBalances = vi.fn(async () => [
      { employeeId: "e1", employeeName: "CARLA DEMO", positionName: null, defined: false, daysEntitled: 22, daysCarriedOver: 0, suggested: 22, taken: 5, scheduled: 2, available: 15 },
    ]);
    renderWith(<LeaveView />, { listLeaveBalances, setLeaveBalance });
    const user = userEvent.setup();
    expect(await screen.findByText("Feriado Teste")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Saldos" }));
    expect(await screen.findByText("sugerido")).toBeInTheDocument();
    const input = screen.getByLabelText("Dias transitados de CARLA DEMO");
    await user.clear(input);
    await user.type(input, "3");
    expect(screen.getByText("18")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(setLeaveBalance).toHaveBeenCalledWith("e1", new Date().getFullYear(), 22, 3);
  });
});

describe("Resolver ocorrência", () => {
  const ISSUE = {
    shiftId: "s1",
    attendanceId: null,
    employeeId: "e1",
    employeeName: "CARLA DEMO",
    workDate: "2026-10-06",
    locationId: "loc-1",
    locationName: "Loja Teste",
    endsNextDay: false,
    periods: [{ plannedStart: "10:00", plannedEnd: "23:00", actualStart: null, actualEnd: null }],
    occurrenceLabel: "Sem entrada",
    reviewStatus: "pending",
    diffMinutes: 0,
    corrections: [],
  } as unknown as AttendanceIssueDetail;

  it("registar ausência (falta justificada) cria o registo e fecha a ocorrência justificada", async () => {
    const registerAbsence = vi.fn(async () => ({ id: "abs" }));
    const correctShiftAttendance = vi.fn(async () => null);
    const onCorrected = vi.fn();
    renderWith(<AttendanceIssueResolutionModal issue={ISSUE} onClose={vi.fn()} onCorrected={onCorrected} />, { registerAbsence, correctShiftAttendance });
    await userEvent.setup().click(screen.getByRole("button", { name: "Resolver ocorrência" }));
    await vi.waitFor(() => expect(onCorrected).toHaveBeenCalled());
    expect(registerAbsence).toHaveBeenCalledWith(expect.objectContaining({ employeeId: "e1", type: "justified", duration: "day", startDate: "2026-10-06" }));
    expect(correctShiftAttendance).toHaveBeenCalledWith(expect.objectContaining({ correctionType: "justify_no_impact", workShiftId: "s1" }));
  });

  it("falta injustificada fecha como 'marcar ausência'; corrigir picagem exige motivo", async () => {
    const correctShiftAttendance = vi.fn(async () => null);
    renderWith(<AttendanceIssueResolutionModal issue={ISSUE} onClose={vi.fn()} onCorrected={vi.fn()} />, { registerAbsence: vi.fn(async () => ({ id: "x" })), correctShiftAttendance });
    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText("Classificação"), "i");
    await user.click(screen.getByRole("button", { name: "Resolver ocorrência" }));
    await vi.waitFor(() => expect(correctShiftAttendance).toHaveBeenCalledWith(expect.objectContaining({ correctionType: "mark_absence" })));

    await user.click(screen.getByLabelText(/Corrigir picagem/));
    expect(screen.getByRole("button", { name: "Resolver ocorrência" })).toBeDisabled();
  });
});
