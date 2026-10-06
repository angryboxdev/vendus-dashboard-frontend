import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { HrApiPort } from "../../domain/ports/out/hr-api.port.ts";
import { HrProvider, type HrModule } from "../../hr.module.tsx";
import { SetEmployeeKioskPinUseCase } from "../../application/use-cases/set-employee-kiosk-pin.use-case.ts";
import { PortalAccessCard } from "./PortalAccessCard.tsx";

// Dados fictícios (RGPD).
function renderCard() {
  let access = { hasAccess: false, email: null as string | null, accountKind: null as "employee" | "staff" | null };
  const api = {
    getPortalAccess: vi.fn(async () => access),
    grantPortalAccess: vi.fn(async () => {
      access = { hasAccess: true, email: "carla@example.com", accountKind: "employee" };
      return { ...access, temporaryPassword: "Abc23defGH45" };
    }),
    revokePortalAccess: vi.fn(async () => {
      access = { hasAccess: false, email: null, accountKind: null };
    }),
  } as unknown as HrApiPort;
  const mod: HrModule = { api, setEmployeeKioskPin: new SetEmployeeKioskPinUseCase(api) };
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <HrProvider module={mod}>
        <PortalAccessCard employeeId="e1" employeeName="Carla Demo" />
      </HrProvider>
    </QueryClientProvider>,
  );
  return api;
}

describe("PortalAccessCard", () => {
  it("dá acesso, mostra a palavra-passe temporária uma vez, e permite retirar com confirmação", async () => {
    const api = renderCard();
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Dar acesso ao Portal" }));
    expect(api.grantPortalAccess).toHaveBeenCalledWith("e1");
    expect(await screen.findByText("Abc23defGH45")).toBeInTheDocument();
    expect(screen.getByText(/Com acesso · carla@example.com/)).toBeInTheDocument();

    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    await user.click(screen.getByRole("button", { name: "Retirar acesso" }));
    expect(confirm.mock.calls[0]![0]).toMatch(/A conta do Portal é apagada/);
    expect(api.revokePortalAccess).toHaveBeenCalledWith("e1");
    expect(await screen.findByRole("button", { name: "Dar acesso ao Portal" })).toBeInTheDocument();
    expect(screen.queryByText("Abc23defGH45")).not.toBeInTheDocument();
    confirm.mockRestore();
  });
});
