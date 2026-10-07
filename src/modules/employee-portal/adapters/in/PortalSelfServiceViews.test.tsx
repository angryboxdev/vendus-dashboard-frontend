import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { MyDocument, MyShift } from "../../domain/entities/portal.ts";
import type { PortalSelfServicePort } from "../../domain/ports/in/portal.ports.ts";
import { EmployeePortalProvider, type EmployeePortalModule } from "../../employee-portal.module.tsx";
import { PortalDocumentsView } from "./PortalDocumentsView.tsx";
import { PortalLeaveView } from "./PortalLeaveView.tsx";
import { PortalScheduleView } from "./PortalScheduleView.tsx";
import { todayLisbon } from "./portal-today.ts";

// Dados fictícios (RGPD).
function renderWith(ui: ReactNode, selfService: Partial<PortalSelfServicePort>) {
  const mod: EmployeePortalModule = {
    getHome: { execute: vi.fn() },
    registerPunch: { execute: vi.fn() },
    selfService: selfService as PortalSelfServicePort,
    newIdempotencyKey: () => "k",
  };
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <EmployeePortalProvider module={mod}>{ui}</EmployeePortalProvider>
    </QueryClientProvider>,
  );
}

const today = todayLisbon();
const SHIFT: MyShift = {
  id: "s1",
  workDate: today,
  startTime: "09:00",
  endTime: "17:00",
  endsNextDay: false,
  secondStartTime: null,
  secondEndTime: null,
  locationId: "loc-1",
  locationName: "Loja Teste",
};

describe("PortalScheduleView", () => {
  it("mostra os turnos da semana e os colegas ao abrir", async () => {
    const listCoworkers = vi.fn(async () => [{ shortName: "Gabriel Teste", positionName: "Cozinheiro", hours: "16:00–23:00" }]);
    renderWith(<PortalScheduleView />, { listShifts: vi.fn(async () => [SHIFT]), listCoworkers });
    expect(await screen.findByText("Hoje · 09:00–17:00")).toBeInTheDocument();
    expect(listCoworkers).not.toHaveBeenCalled();
    await userEvent.setup().click(screen.getByRole("button", { name: "Quem trabalha comigo" }));
    expect(await screen.findByText("Gabriel Teste")).toBeInTheDocument();
    expect(listCoworkers).toHaveBeenCalledWith("s1");
  });

  it("semana sem turnos", async () => {
    renderWith(<PortalScheduleView />, { listShifts: vi.fn(async () => []) });
    expect(await screen.findByText("Sem turnos publicados nesta semana.")).toBeInTheDocument();
  });
});

describe("PortalDocumentsView", () => {
  const docs: MyDocument[] = [
    { id: "r1", categoryLabel: "Recibo de vencimento", fileName: "r.pdf", status: "valid", canReplace: false, lastRejection: null, period: "2026-09", isPayslip: true, issuedAt: null, expiresAt: null, uploadedAt: "" },
    { id: "d1", categoryLabel: "Atestado de saúde", fileName: "a.pdf", status: "valid", canReplace: true, lastRejection: null, period: null, isPayslip: false, issuedAt: null, expiresAt: "2020-01-31", uploadedAt: "" },
  ];

  it("separa recibos, assinala vencido e abre a janela no toque (iOS)", async () => {
    const win = { location: { href: "" }, close: vi.fn() };
    const open = vi.spyOn(window, "open").mockReturnValue(win as unknown as Window);
    const documentUrl = vi.fn(async () => "https://signed/r1");
    renderWith(<PortalDocumentsView />, { listDocuments: vi.fn(async () => docs), documentUrl });

    expect(await screen.findByText("SET 2026 · Recibo de vencimento")).toBeInTheDocument();
    expect(screen.getByText("Vencido a 31/01/2020")).toBeInTheDocument();
    await userEvent.setup().click(screen.getAllByRole("button", { name: "Abrir" })[0]!);
    expect(open).toHaveBeenCalledWith("", "_blank");
    await vi.waitFor(() => expect(win.location.href).toBe("https://signed/r1"));
    expect(documentUrl).toHaveBeenCalledWith("r1");
    open.mockRestore();
  });

  it("falha a obter o URL → fecha a janela e avisa", async () => {
    const win = { location: { href: "" }, close: vi.fn() };
    const open = vi.spyOn(window, "open").mockReturnValue(win as unknown as Window);
    renderWith(<PortalDocumentsView />, { listDocuments: vi.fn(async () => docs), documentUrl: vi.fn(async () => Promise.reject(new Error("x"))) });
    await userEvent.setup().click((await screen.findAllByRole("button", { name: "Abrir" }))[0]!);
    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível abrir o documento");
    expect(win.close).toHaveBeenCalled();
    open.mockRestore();
  });
});

describe("PortalLeaveView", () => {
  it("lista as ausências do ano, sem saldo", async () => {
    const year = Number(today.slice(0, 4));
    const getLeave = vi.fn(async () => ({ year, entries: [{ id: "l1", type: "vacation" as const, startDate: `${year}-08-03`, endDate: `${year}-08-05`, workingDays: 3 }] }));
    renderWith(<PortalLeaveView />, { getLeave });
    expect(await screen.findByText("Férias")).toBeInTheDocument();
    expect(screen.getByText("3 dias úteis")).toBeInTheDocument();
    expect(screen.queryByText(/saldo/i)).not.toBeInTheDocument();
    expect(getLeave).toHaveBeenCalledWith(year);
  });
});
