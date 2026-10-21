import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { AbsenceRequest } from "../../../domain/entities/absences.ts";
import { emptyType, flowProblems, formatAmount, formatPeriod } from "../../../domain/services/absences.service.ts";
import { fakeNovoRhModule } from "../../../fake-module.test-utils.ts";
import { NovoRhProvider, type NovoRhModule } from "../../../novo-rh.module.tsx";
import { AbsencesView } from "./AbsencesView.tsx";
import { FlowsPanel, TypesPanel } from "./ConfigPanels.tsx";
import { MyAbsencesPanel, RequestsPanel } from "./RequestPanels.tsx";

function renderWith(m: NovoRhModule, view: ReactNode = <AbsencesView />) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <NovoRhProvider module={m}>
        {view}
      </NovoRhProvider>
    </QueryClientProvider>,
  );
}

const mod = () =>
  fakeNovoRhModule({ settings: { listEmployees: vi.fn(async () => [{ id: "e1", label: "Ana Teste" }]) } as unknown as NovoRhModule["settings"] });

const REQ: AbsenceRequest = {
  id: "r1", employeeId: "e1", typeId: "t1", typeName: "Férias", typeColor: "#ED5C32", private: false, kind: "absence",
  startDate: "2026-10-19", endDate: "2026-10-23", startTime: null, endTime: null, halfDay: false, amount: 5, unit: "days", period: "2026-01-01",
  status: "pending", comment: null, requestedBy: "ana", levels: [{ approvers: ["u-admin"], escalated: true }], currentLevel: 0, cancelReason: null, createdAt: "2026-10-12T09:00:00Z",
};
const TYPE = { ...emptyType(), id: "t1", name: "Consulta médica", unit: "hours" as const, archived: false };

describe("Ausências — formatação e regras do ecrã", () => {
  it("quantidades, períodos e CF-5", () => {
    expect(formatAmount(1, "days")).toBe("1 dia");
    expect(formatAmount(2.5, "hours")).toBe("2,5 h");
    expect(formatPeriod(REQ)).toBe("19/10 – 23/10/2026");
    expect(formatPeriod({ ...REQ, endDate: REQ.startDate, startTime: "09:00", endTime: "12:00" })).toBe("19/10/2026 09:00–12:00");
    expect(flowProblems([{ people: ["u"], roles: [] }, { people: [], roles: [] }])).toEqual([2]);
    expect(emptyType()).toMatchObject({ requiresApproval: true, limitAmount: null, private: false });
  });
});

describe("Ausências — ecrãs", () => {
  it("caixa do aprovador mostra o escalonamento e aprova com comentário", async () => {
    const m = mod();
    m.myAbsences.approvals = vi.fn(async () => [REQ]);
    m.myAbsences.decide = vi.fn(async () => ({ ...REQ, status: "approved" as const }));
    renderWith(m);
    const user = userEvent.setup();
    const row = (await screen.findByText("19/10 – 23/10/2026")).closest("tr")!;
    expect(within(row).getByText("Escalado para o recurso")).toBeInTheDocument();
    expect(within(row).getByText("Ana Teste")).toBeInTheDocument();
    await user.type(within(row).getByLabelText(/Comentário/), "Boa viagem");
    await user.click(within(row).getByRole("button", { name: "Aprovar" }));
    expect(m.myAbsences.decide).toHaveBeenCalledWith("r1", "approve", "Boa viagem");
  });

  it("cancelar uma aprovada exige motivo; pendente não", async () => {
    const m = mod();
    m.absences.listRequests = vi.fn(async () => [{ ...REQ, status: "approved" as const }]);
    m.absences.cancel = vi.fn(async () => ({ ...REQ, status: "cancelled" as const }));
    renderWith(m, <RequestsPanel />);
    const user = userEvent.setup();
    const row = (await screen.findByText("19/10 – 23/10/2026")).closest("tr")!;
    const cancel = within(row).getByRole("button", { name: "Cancelar ausência" });
    expect(cancel).toBeDisabled();
    await user.type(within(row).getByLabelText(/Motivo do cancelamento/), "Mudou de semana");
    await user.click(cancel);
    expect(m.absences.cancel).toHaveBeenCalledWith("r1", "Mudou de semana");
  });

  it("CF_5_fluxo_com_nivel_vazio_nao_deixa_gravar", async () => {
    const m = mod();
    m.access.listUsers = vi.fn(async () => [{ userId: "u-rh", label: "RH", profileId: null }]);
    m.access.listProfiles = vi.fn(async () => []);
    m.absences.createFlow = vi.fn();
    renderWith(m, <FlowsPanel />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Novo fluxo" }));
    await user.type(screen.getByLabelText("Nome"), "Férias");
    await user.click(screen.getByRole("button", { name: "Adicionar nível" }));
    expect(screen.getByText("O nível 2 não tem aprovadores.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Remover nível 2" }));
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    expect(m.absences.createFlow).toHaveBeenCalledWith({ name: "Férias", scope: "absences", isDefault: true, levels: [{ people: [], roles: ["managers"] }], fallbackUserIds: [] });
  });

  it("fluxo para correções de ponto (FE-113)", async () => {
    const m = mod();
    m.access.listUsers = vi.fn(async () => []);
    m.access.listProfiles = vi.fn(async () => []);
    m.absences.createFlow = vi.fn();
    renderWith(m, <FlowsPanel />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Novo fluxo" }));
    await user.type(screen.getByLabelText("Nome"), "Correções");
    await user.selectOptions(screen.getByLabelText("Para"), "clock");
    expect(screen.getByText(/Os pedidos de correção passam a seguir estes níveis/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    expect(m.absences.createFlow).toHaveBeenCalledWith(expect.objectContaining({ name: "Correções", scope: "clock" }));
  });

  it("pedido por horas envia horas e um só dia (RE-21)", async () => {
    const m = mod();
    m.myAbsences.types = vi.fn(async () => [TYPE]);
    m.myAbsences.request = vi.fn(async () => REQ);
    renderWith(m, <MyAbsencesPanel />);
    const user = userEvent.setup();
    const box = await screen.findByRole("region", { name: "Pedir ausência" });
    await screen.findByRole("option", { name: "Consulta médica" });
    await user.selectOptions(within(box).getByLabelText("Tipo de ausência"), "t1");
    await user.type(within(box).getByLabelText("Início"), "2026-10-19");
    await user.click(within(box).getByRole("button", { name: "Pedir ausência" }));
    expect(m.myAbsences.request).toHaveBeenCalledWith({ typeId: "t1", startDate: "2026-10-19", endDate: "2026-10-19", startTime: "09:00", endTime: "12:00", halfDay: false, comment: null });
  });

  it("tipo novo vem com valores seguros e grava", async () => {
    const m = mod();
    m.absences.createType = vi.fn(async () => TYPE);
    renderWith(m, <TypesPanel />);
    const user = userEvent.setup();
    expect(await screen.findByText(/Ainda não há tipos de ausência/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Novo tipo" }));
    await user.type(screen.getByLabelText("Nome"), "Casamento");
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    expect(m.absences.createType).toHaveBeenCalledWith(expect.objectContaining({ name: "Casamento", requiresApproval: true, limitAmount: null, timeImpact: "reduce_theoretical" }));
  });
});
