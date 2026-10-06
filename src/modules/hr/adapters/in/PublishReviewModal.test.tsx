import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { WorkShift } from "../../domain/entities/schedule.ts";
import type { HrApiPort } from "../../domain/ports/out/hr-api.port.ts";
import { HrProvider, type HrModule } from "../../hr.module.tsx";
import { SetEmployeeKioskPinUseCase } from "../../application/use-cases/set-employee-kiosk-pin.use-case.ts";
import { groupDraftsByDay, reviewShiftHours } from "../../domain/services/publish-review.service.ts";
import { PublishReviewModal } from "./PublishReviewModal.tsx";

// Dados fictícios (RGPD).
function shift(id: string, employeeName: string, workDate: string, extra: Partial<WorkShift> = {}): WorkShift {
  return {
    id,
    employeeId: `e-${employeeName}`,
    employeeName,
    workDate,
    startTime: "10:00",
    endTime: "18:00",
    endsNextDay: false,
    secondStartTime: null,
    secondEndTime: null,
    locationId: "loc-1",
    breakMinutes: 0,
    notes: null,
    status: "draft",
    source: "manual",
    rotationId: null,
    seriesId: null,
    templateId: null,
    automationId: null,
    attendanceStatus: null,
    createdAt: "",
    updatedAt: "",
    ...extra,
  };
}

const SHIFTS = [
  shift("s1", "Carla Demo", "2026-10-07"),
  shift("s2", "Ana Teste", "2026-10-07", { startTime: "20:00", endTime: "00:00", endsNextDay: true }),
  shift("s3", "Ana Teste", "2026-10-08"),
  shift("s4", "Ana Teste", "2026-10-09", { status: "published" }),
];

describe("Rever e publicar", () => {
  it("regras: só rascunhos, por dia e por colaborador; horário noturno com (+1)", () => {
    const days = groupDraftsByDay(SHIFTS);
    expect(days.map((d) => [d.label, d.shifts.map((s) => s.employeeName)])).toEqual([
      ["Quarta, 07/10", ["Ana Teste", "Carla Demo"]],
      ["Quinta, 08/10", ["Ana Teste"]],
    ]);
    expect(reviewShiftHours(SHIFTS[1]!)).toBe("20:00–00:00 (+1)");
  });

  it("nada é publicado sem confirmar; desmarcar um turno publica só os restantes", async () => {
    const api = {
      listWorkShifts: vi.fn(async () => SHIFTS),
      publishWorkShifts: vi.fn(async () => []),
    } as unknown as HrApiPort;
    const mod: HrModule = { api, setEmployeeKioskPin: new SetEmployeeKioskPinUseCase(api) };
    const onPublished = vi.fn();
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <HrProvider module={mod}>
          <PublishReviewModal range={{ from: "2026-10-05", to: "2026-10-11" }} locationName={() => "Loja Teste"} onClose={() => {}} onPublished={onPublished} />
        </HrProvider>
      </QueryClientProvider>,
    );
    const user = userEvent.setup();

    expect(await screen.findByText("Selecionar todos (3)")).toBeInTheDocument();
    expect(api.listWorkShifts).toHaveBeenCalledWith({ from: "2026-10-05", to: "2026-10-11", status: "draft" });
    expect(api.publishWorkShifts).not.toHaveBeenCalled();

    const thursday = screen.getByRole("region", { name: "Quinta, 08/10" });
    await user.click(within(thursday).getByLabelText("Ana Teste Quinta, 08/10"));
    await user.click(screen.getByRole("button", { name: "Publicar 2 turno(s)" }));

    expect(api.publishWorkShifts).toHaveBeenCalledWith(["s2", "s1"]);
    expect(onPublished).toHaveBeenCalledWith(2);
  });
});
