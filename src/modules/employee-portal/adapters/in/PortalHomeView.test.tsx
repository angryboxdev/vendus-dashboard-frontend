import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PunchRefusedError, type PortalHome, type PunchResult } from "../../domain/entities/portal.ts";
import { EmployeePortalProvider, type EmployeePortalModule } from "../../employee-portal.module.tsx";
import { PortalHomeView } from "./PortalHomeView.tsx";

// Dados fictícios (RGPD).
function home(punch: Partial<PortalHome["punch"]> = {}): PortalHome {
  return {
    employee: { id: "e1", shortName: "Carla" },
    nextShift: {
      workDate: new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Lisbon" }).format(new Date()),
      startTime: "09:00",
      endTime: "17:00",
      endsNextDay: false,
      secondStartTime: null,
      secondEndTime: null,
      locationId: "loc-1",
      locationName: "Loja Teste",
    },
    punch: { state: "not_in", since: null, action: "in", blockedReason: null, geofencePolicy: "warn", ...punch },
  };
}

function renderView(opts: { homes: PortalHome[]; punch: (key: string) => Promise<PunchResult> }) {
  const homes = [...opts.homes];
  const keys: string[] = [];
  let seq = 0;
  const mod: EmployeePortalModule = {
    getHome: { execute: vi.fn(async () => (homes.length > 1 ? homes.shift()! : homes[0]!)) },
    registerPunch: {
      execute: vi.fn(async ({ idempotencyKey }) => {
        keys.push(idempotencyKey);
        return opts.punch(idempotencyKey);
      }),
    },
    selfService: {} as EmployeePortalModule["selfService"],
    newIdempotencyKey: () => `key-${++seq}`,
  };
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <EmployeePortalProvider module={mod}>
        <PortalHomeView />
      </EmployeePortalProvider>
    </QueryClientProvider>,
  );
  return { mod, keys };
}

const RESULT: PunchResult = { kind: "in", time: "08:58", serverAt: "", geofence: { status: "inside", reason: null, distanceM: 20 }, flagged: false, replay: false };

describe("PortalHomeView", () => {
  it("mostra o próximo turno, o estado e regista a entrada; o estado passa a 'Entrada registada'", async () => {
    renderView({ homes: [home(), home({ state: "in", since: "08:58", action: "out" })], punch: async () => RESULT });
    const user = userEvent.setup();

    expect(await screen.findByText("Hoje · 09:00–17:00")).toBeInTheDocument();
    expect(screen.getByText("Loja Teste")).toBeInTheDocument();
    expect(screen.getByTestId("punch-state")).toHaveTextContent("Ainda não entrou");
    expect(screen.getByText(/lê a localização do telemóvel uma única vez/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Registar entrada" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Entrada registada às 08:58");
    await waitFor(() => expect(screen.getByTestId("punch-state")).toHaveTextContent("Entrada registada às 08:58"));
    expect(screen.getByRole("button", { name: "Registar saída" })).toBeInTheDocument();
  });

  it("falha de rede: novo toque reutiliza a mesma chave; recusa de negócio gera chave nova", async () => {
    const responses: Array<PunchResult | Error> = [new TypeError("offline"), new PunchRefusedError("ALREADY_IN", "A entrada já está registada."), RESULT];
    const { keys } = renderView({
      homes: [home()],
      punch: async () => {
        const r = responses.shift()!;
        if (r instanceof Error) throw r;
        return r;
      },
    });
    const user = userEvent.setup();
    const button = await screen.findByRole("button", { name: "Registar entrada" });

    await user.click(button);
    await screen.findByRole("status");
    await user.click(screen.getByRole("button", { name: "Registar entrada" }));
    expect(await screen.findByText("A entrada já está registada.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Registar entrada" }));

    expect(keys).toEqual(["key-1", "key-1", "key-2"]);
  });

  it("ainda cedo: botão desativado com a explicação; sem GPS → sem aviso de localização", async () => {
    renderView({
      homes: [home({ blockedReason: { code: "TOO_EARLY", shiftStart: "09:00", opensAt: "08:30" }, geofencePolicy: "off" })],
      punch: async () => RESULT,
    });
    expect(await screen.findByRole("button", { name: "Registar entrada" })).toBeDisabled();
    expect(screen.getByText("O turno começa às 09:00. Pode registar a entrada a partir das 08:30.")).toBeInTheDocument();
    expect(screen.queryByText(/lê a localização/)).not.toBeInTheDocument();
  });
});
