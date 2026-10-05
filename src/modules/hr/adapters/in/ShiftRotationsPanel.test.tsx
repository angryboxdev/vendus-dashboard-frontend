import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ShiftRotation } from "../../domain/entities/schedule.ts";
import type { HrApiPort } from "../../domain/ports/out/hr-api.port.ts";
import { HrProvider, type HrModule } from "../../hr.module.tsx";
import { SetEmployeeKioskPinUseCase } from "../../application/use-cases/set-employee-kiosk-pin.use-case.ts";
import { ShiftRotationsPanel } from "./ShiftRotationsPanel.tsx";

// Dados fictícios (RGPD).
const ROTATION: ShiftRotation = {
  id: "r1",
  participantEmployeeIds: ["e1", "e2"],
  participantNames: ["Carlos Andrés", "Gabriel Gomes"],
  patternA: { startTime: "11:30", endTime: "15:30", secondStartTime: null, secondEndTime: null },
  patternB: { startTime: "17:00", endTime: "23:00", secondStartTime: null, secondEndTime: null },
  locationId: "loc-1",
  anchorDate: "2026-10-19",
  autoSwitchWeekly: true,
  active: false,
};

function renderPanel() {
  let rotations = [ROTATION];
  const api = {
    listShiftRotations: async () => rotations,
    deleteShiftRotation: vi.fn(async (id: string) => {
      rotations = rotations.filter((r) => r.id !== id);
    }),
  } as unknown as HrApiPort;
  const mod: HrModule = { api, setEmployeeKioskPin: new SetEmployeeKioskPinUseCase(api) };
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <HrProvider module={mod}>
        <ShiftRotationsPanel />
      </HrProvider>
    </QueryClientProvider>,
  );
  return api;
}

describe("ShiftRotationsPanel (rotações antigas)", () => {
  it("já não permite criar rotações e apaga com confirmação; sem rotações o painel desaparece", async () => {
    const api = renderPanel();
    const user = userEvent.setup();
    expect(await screen.findByText("Carlos Andrés / Gabriel Gomes")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Nova rotação/ })).not.toBeInTheDocument();

    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
    await user.click(screen.getByRole("button", { name: "Apagar rotação Carlos Andrés / Gabriel Gomes" }));
    expect(api.deleteShiftRotation).not.toHaveBeenCalled(); // cancelou

    await user.click(screen.getByRole("button", { name: "Apagar rotação Carlos Andrés / Gabriel Gomes" }));
    expect(api.deleteShiftRotation).toHaveBeenCalledWith("r1");
    await waitFor(() => expect(screen.queryByRole("region", { name: "Rotações antigas" })).not.toBeInTheDocument());
    confirm.mockRestore();
  });
});
