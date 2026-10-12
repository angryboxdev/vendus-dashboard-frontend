import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../../../../../lib/api.ts";
import type { PayPeriod } from "../../../domain/entities/periods.ts";
import { fakeNovoRhModule } from "../../../fake-module.test-utils.ts";
import { NovoRhProvider, type NovoRhModule } from "../../../novo-rh.module.tsx";
import { PeriodsView } from "./PeriodsView.tsx";

function renderWith(m: NovoRhModule) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <NovoRhProvider module={m}>
        <PeriodsView />
      </NovoRhProvider>
    </QueryClientProvider>,
  );
}

const OPEN: PayPeriod = { id: "p1", scopeType: "organization", scopeId: null, startDate: "2026-10-01", endDate: "2026-10-31", status: "open" };
const PENDING = [{ type: "incident" as const, id: "i1", employeeId: "e1", date: "2026-10-08", label: "Incidente: missing_out" }];

const mod = (period: PayPeriod = OPEN) => {
  const m = fakeNovoRhModule({
    settings: { listEmployees: vi.fn(async () => [{ id: "e1", label: "Ana Teste" }]), listLocations: vi.fn(async () => [{ id: "l1", label: "Porto" }]) } as unknown as NovoRhModule["settings"],
  });
  m.periods.list = vi.fn(async () => [period]);
  return m;
};

async function open(user = userEvent.setup()) {
  await user.click(await screen.findByRole("button", { name: /2026-10-01 – 2026-10-31/ }));
  return user;
}

describe("Fecho de período", () => {
  it("pendentes: fechar só com motivo de exceção", async () => {
    const m = mod();
    m.periods.precheck = vi.fn(async () => ({ employees: 3, pending: PENDING }));
    m.periods.close = vi.fn(async () => ({ id: "c1", closureNo: 1, closedBy: "x", exceptionReason: "ok", exceptions: PENDING, totals: [], diff: null, createdAt: "2026-11-02T10:00:00Z" }));
    renderWith(m);
    const user = await open();
    await user.click(screen.getByRole("button", { name: "Verificar pendentes" }));
    expect(await screen.findByText("2026-10-08 · Ana Teste · Incidente: missing_out")).toBeInTheDocument();
    const close = screen.getByRole("button", { name: "Fechar período" });
    expect(close).toBeDisabled();
    await user.type(screen.getByLabelText(/Motivo da exceção/), "Tratado na folha manual");
    await user.click(close);
    expect(m.periods.close).toHaveBeenCalledWith("p1", "Tratado na folha manual");
  });

  it("fechar sem verificar e a API devolver pendentes mostra a lista", async () => {
    const m = mod();
    m.periods.close = vi.fn(async () => {
      throw new ApiError("Há pendentes", 409, { pending: PENDING });
    });
    renderWith(m);
    const user = await open();
    await user.click(screen.getByRole("button", { name: "Fechar período" }));
    expect(await screen.findByText(/1 pendente\(s\)/)).toBeInTheDocument();
  });

  it("período fechado: exportar e pedir reabertura com motivo", async () => {
    const m = mod({ ...OPEN, status: "closed" });
    m.periods.requestExport = vi.fn(async () => ({ id: "x1", periodId: "p1", kind: "payroll" as const, status: "queued" as const, error: null, fileName: null, includeSensitive: false, expiresAt: null, createdAt: "2026-11-02T10:00:00Z" }));
    m.periods.requestReopen = vi.fn(async () => ({}) as never);
    renderWith(m);
    const user = await open();
    await user.click(screen.getByRole("button", { name: "Exportar para salários" }));
    expect(m.periods.requestExport).toHaveBeenCalledWith("p1", "payroll", false);
    expect(await screen.findByText(/Exportação em fila/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pedir reabertura" })).toBeDisabled();
    await user.type(screen.getByLabelText("Motivo da reabertura"), "Faltou uma baixa");
    await user.click(screen.getByRole("button", { name: "Pedir reabertura" }));
    expect(m.periods.requestReopen).toHaveBeenCalledWith("p1", "Faltou uma baixa");
  });

  it("TK_18_reabertura_mostra_aprovacoes_e_o_erro_de_quem_pediu", async () => {
    const m = mod();
    m.periods.reopenings = vi.fn(async () => [{ id: "r1", periodId: "p1", requestedBy: "rh1", requestedByUserId: "u1", reason: "Correção", approvals: [{ userId: "u2", by: "rh2", at: "x" }], status: "pending" as const }]);
    m.periods.approveReopen = vi.fn(async () => {
      throw new ApiError("Quem pede a reabertura não a pode aprovar.", 403);
    });
    renderWith(m);
    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: "Reaberturas" }));
    expect(await screen.findByText("rh1: Correção · 1/2 aprovações")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Aprovar reabertura" }));
    expect(await screen.findByText("Quem pede a reabertura não a pode aprovar.")).toBeInTheDocument();
  });

  it("transferências: descarregar um ficheiro pronto", async () => {
    const m = mod();
    m.periods.exports = vi.fn(async () => [{ id: "x1", periodId: "p1", kind: "payroll" as const, status: "done" as const, error: null, fileName: "salarios.csv", includeSensitive: false, expiresAt: "2026-11-03T10:00:00Z", createdAt: "2026-11-02T10:00:00Z" }]);
    m.periods.download = vi.fn(async () => ({ blob: new Blob(["a;b"]), fileName: "salarios.csv" }));
    URL.createObjectURL = vi.fn(() => "blob:x");
    URL.revokeObjectURL = vi.fn();
    renderWith(m);
    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: "Transferências" }));
    const row = (await screen.findByText("Pronta")).closest("tr")!;
    expect(within(row).getByText("2026-11-03 10:00")).toBeInTheDocument();
    await user.click(within(row).getByRole("button", { name: "Descarregar" }));
    expect(m.periods.download).toHaveBeenCalled();
  });
});
