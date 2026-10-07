import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { HrApiPort } from "../../domain/ports/out/hr-api.port.ts";
import type { RequestsInbox } from "../../domain/entities/portal-requests.ts";
import { HrProvider, type HrModule } from "../../hr.module.tsx";
import { SetEmployeeKioskPinUseCase } from "../../application/use-cases/set-employee-kiosk-pin.use-case.ts";
import { HrRequestsView } from "./HrRequestsView.tsx";

// Dados fictícios (RGPD).
const INBOX: RequestsInbox = {
  total: 2,
  requests: [
    {
      id: "r1",
      kind: "day_off",
      status: "pending",
      workShiftId: null,
      startDate: "2026-10-12",
      endDate: "2026-10-13",
      reasonLabel: "Assunto pessoal",
      reasonText: null,
      attachmentName: null,
      decisionNote: null,
      decidedAt: null,
      createdAt: "2026-10-07T10:00:00Z",
      employeeId: "e1",
      employeeName: "CARLA DEMO",
      shiftHours: null,
    },
  ],
  documents: [{ id: "d1", employeeId: "e2", employeeName: "OUTRO DEMO", categoryLabel: "Atestado de saúde", fileName: "foto.jpg", expiresAt: null, submittedAt: "2026-10-07T09:00:00Z" }],
};

function renderView(api: Partial<HrApiPort>) {
  const full = { getRequestsInbox: vi.fn(async () => INBOX), ...api } as unknown as HrApiPort;
  const mod: HrModule = { api: full, setEmployeeKioskPin: new SetEmployeeKioskPinUseCase(full) };
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <HrProvider module={mod}>
        <HrRequestsView />
      </HrProvider>
    </QueryClientProvider>,
  );
}

describe("HrRequestsView — Caixa de pedidos", () => {
  it("aprova uma folga; rejeitar um documento exige motivo", async () => {
    const decidePortalRequest = vi.fn(async () => INBOX.requests[0]!);
    const reviewEmployeeDocument = vi.fn(async () => undefined);
    renderView({ decidePortalRequest, reviewEmployeeDocument });
    const user = userEvent.setup();

    expect(await screen.findByText("Pedido de folga · CARLA DEMO")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Aprovar" }));
    expect(decidePortalRequest).toHaveBeenCalledWith("r1", "approve", null);

    const rejectButtons = screen.getAllByRole("button", { name: "Rejeitar" });
    await user.click(rejectButtons[rejectButtons.length - 1]!);
    const confirm = screen.getByRole("button", { name: "Confirmar rejeição" });
    expect(confirm).toBeDisabled();
    await user.type(screen.getByLabelText(/Motivo da rejeição/), "Foto ilegível");
    await user.click(confirm);
    expect(reviewEmployeeDocument).toHaveBeenCalledWith("e2", "d1", { decision: "reject", note: "Foto ilegível" });
  });

  it("sem nada por decidir", async () => {
    renderView({ getRequestsInbox: vi.fn(async () => ({ total: 0, requests: [], documents: [] })) });
    expect(await screen.findByText(/Nada por decidir/)).toBeInTheDocument();
  });
});
