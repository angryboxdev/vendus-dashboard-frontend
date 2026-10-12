import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../../../../../lib/api.ts";
import type { AttendanceDays, MyClockStatus } from "../../../domain/entities/attendance.ts";
import { formatDuration, nextActions, PunchQueue, utcToZoned, weekOf, zonedToUtc } from "../../../domain/services/attendance.service.ts";
import { fakeNovoRhModule, memoryQueue } from "../../../fake-module.test-utils.ts";
import { NovoRhProvider, type NovoRhModule } from "../../../novo-rh.module.tsx";
import { AttendanceView } from "./AttendanceView.tsx";

function renderWith(m: NovoRhModule) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <NovoRhProvider module={m}>
        <AttendanceView />
      </NovoRhProvider>
    </QueryClientProvider>,
  );
}

const DAY = { workDate: "2026-10-07", workedSeconds: 8 * 3600 + 59 * 60 + 45, breakSeconds: 3600, nightSeconds: 0, theoreticalSeconds: 8 * 3600, excessSeconds: 3600 + 59 * 60 + 45, pendingSeconds: 0, segments: [], incidents: [] as AttendanceDays["days"][number]["incidents"], version: 1 };
const DAYS: AttendanceDays = {
  employeeId: "e1",
  timeZone: "Europe/Lisbon",
  days: [DAY, { ...DAY, workDate: "2026-10-08", workedSeconds: 0, excessSeconds: -8 * 3600, incidents: ["missing_in"] }],
  totals: { workedSeconds: DAY.workedSeconds, theoreticalSeconds: 16 * 3600, excessSeconds: 0, pendingSeconds: 0, nightSeconds: 0 },
  events: [
    { id: "ev1", employeeId: "e1", occurredAt: "2026-10-07T06:15:29Z", segmentType: "work", source: "pwa", locationId: null },
    { id: "ev2", employeeId: "e1", occurredAt: "2026-10-07T16:15:25Z", segmentType: "off", source: "pwa", locationId: null },
  ],
  revisions: [],
  incidents: [],
  refusable: [],
};

const mod = () =>
  fakeNovoRhModule({ settings: { listEmployees: vi.fn(async () => [{ id: "e1", label: "Ana Teste" }]) } as unknown as NovoRhModule["settings"] });

describe("Assiduidade — regras do ecrã", () => {
  it("duração truncada ao minuto, fusos e semana", () => {
    expect(formatDuration(8 * 3600 + 59 * 60 + 45)).toBe("8h 59min");
    expect(formatDuration(-90 * 60)).toBe("-1h 30min");
    expect(zonedToUtc("2026-10-07T09:00", "Europe/Lisbon")).toBe("2026-10-07T08:00:00.000Z");
    expect(zonedToUtc("2026-10-07T09:00", "Europe/Madrid")).toBe("2026-10-07T07:00:00.000Z");
    expect(zonedToUtc("2026-12-07T09:00", "Europe/Lisbon")).toBe("2026-12-07T09:00:00.000Z");
    expect(utcToZoned("2026-10-07T08:00:00.000Z", "Europe/Lisbon")).toBe("2026-10-07T09:00");
    expect(weekOf("2026-10-11")).toEqual({ from: "2026-10-05", to: "2026-10-11" });
    expect(nextActions("off")).toEqual(["work", "remote"]);
    expect(nextActions("work")).toContain("off");
  });

  it("RE_9_fila_offline_mantem_o_id_e_so_tira_depois_de_enviada_ou_recusada", async () => {
    const storage = memoryQueue();
    let n = 0;
    const q = new PunchQueue(storage, () => `c-${++n}`);
    q.add("work", "2026-10-12T08:00:00Z");
    q.add("off", "2026-10-12T12:00:00Z");
    const offline = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    expect(await q.flush(offline, (e) => !(e instanceof ApiError))).toEqual({ sent: 0, refused: [] });
    expect(q.pending().map((p) => p.clientEventId)).toEqual(["c-1", "c-2"]);
    const sent: string[] = [];
    const online = vi.fn(async (p: { clientEventId: string }) => {
      sent.push(p.clientEventId);
      if (p.clientEventId === "c-2") throw new ApiError("Já está neste estado.", 409);
    });
    const r = await q.flush(online, (e) => !(e instanceof ApiError));
    expect(sent).toEqual(["c-1", "c-2"]);
    expect(r.sent).toBe(1);
    expect(r.refused).toHaveLength(1);
    expect(q.pending()).toEqual([]);
  });
});

describe("Assiduidade — gestão", () => {
  it("dias com totais do motor, incidente e correção com motivo obrigatório (RE-10)", async () => {
    const m = mod();
    m.attendance.days = vi.fn(async () => DAYS);
    m.attendance.revise = vi.fn(async () => ({}) as never);
    renderWith(m);
    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: "Dias" }));
    await screen.findByRole("option", { name: "Ana Teste" });
    await user.selectOptions(screen.getByLabelText("Colaborador"), "e1");
    expect(await screen.findByText("8h 59min")).toBeInTheDocument();
    expect(screen.getByText("Falta")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "2026-10-07" }));
    expect(screen.getByText("07:15")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Mudar 17:15" }));
    const save = screen.getByRole("button", { name: "Guardar correção" });
    expect(save).toBeDisabled();
    await user.type(screen.getByLabelText("Motivo da correção"), "Saiu às 18h");
    const when = screen.getByLabelText("Data e hora");
    await user.clear(when);
    await user.type(when, "2026-10-07T18:00");
    await user.click(save);
    expect(m.attendance.revise).toHaveBeenCalledWith("e1", { operation: "update", targetEventId: "ev2", occurredAt: "2026-10-07T17:00:00.000Z", segmentType: null, reason: "Saiu às 18h" });
  });

  it("validar incidente exige comentário (D8)", async () => {
    const m = mod();
    m.attendance.incidents = vi.fn(async () => [
      { id: "i1", employeeId: "e1", workDate: "2026-10-08", type: "missing_out" as const, source: "engine", status: "open" as const, comment: null, resolvedBy: null, resolvedAt: null },
    ]);
    m.attendance.resolveIncident = vi.fn(async () => ({}) as never);
    renderWith(m);
    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: "Incidentes" }));
    const row = (await screen.findByRole("cell", { name: "Saída esquecida" })).closest("tr")!;
    const validate = within(row).getByRole("button", { name: "Validar horas" });
    expect(validate).toBeDisabled();
    await user.type(within(row).getByLabelText(/Comentário/), "Confirmado");
    await user.click(validate);
    expect(m.attendance.resolveIncident).toHaveBeenCalledWith("i1", "validate", "Confirmado");
  });

  it("recusar um pedido de correção exige motivo; aprovar não", async () => {
    const m = mod();
    m.attendance.corrections = vi.fn(async () => [
      { id: "c1", employeeId: "e1", requestedBy: "ana", operation: "add" as const, targetEventId: null, occurredAt: "2026-10-10T08:00:00Z", segmentType: "work" as const, reason: "Sem rede", status: "pending" as const, decidedBy: null, decidedAt: null, decisionComment: null, createdAt: "2026-10-10T09:00:00Z" },
    ]);
    m.attendance.decide = vi.fn(async () => ({}) as never);
    renderWith(m);
    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: "Pedidos de correção" }));
    const row = (await screen.findByText("Sem rede")).closest("tr")!;
    expect(within(row).getByRole("button", { name: "Recusar" })).toBeDisabled();
    await user.click(within(row).getByRole("button", { name: "Aprovar" }));
    expect(m.attendance.decide).toHaveBeenCalledWith("c1", "approve", null);
  });
});

describe("Assiduidade — o meu ponto", () => {
  const STATUS: MyClockStatus = { employeeId: "e1", timeZone: "Europe/Lisbon", state: "off", since: null, today: { ...DAY, workDate: "2026-10-12", workedSeconds: 0 }, refusable: [] };

  it("picar envia pela fila com um id e a hora do dispositivo; sem rede fica pendente", async () => {
    const m = mod();
    m.myClock.status = vi.fn(async () => STATUS);
    m.myClock.punch = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    renderWith(m);
    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: "O meu ponto" }));
    await user.click(await screen.findByRole("button", { name: "Trabalho" }));
    await waitFor(() => expect(m.myClock.punch).toHaveBeenCalledWith(expect.objectContaining({ segmentType: "work", clientEventId: expect.any(String), occurredAt: expect.any(String) })));
    expect(await screen.findByText(/1 marcação\(ões\) por enviar/)).toBeInTheDocument();
  });

  it("pausas do catálogo (FE-103): escolhe-se pelo nome e vai o tipo na marcação", async () => {
    const m = mod();
    m.myClock.status = vi.fn(async () => ({ ...STATUS, state: "work" as const, since: "2026-10-12T08:00:00Z" }));
    m.myClock.breakTypes = vi.fn(async () => [{ id: "b1", name: "Almoço", color: null, remuneration: "unpaid" as const, hybridPaidMinutes: null, maxMinutes: 60, windowStart: null, windowEnd: null, maxUsesPerDay: 1, weekdays: null, archived: false, version: 1 }]);
    m.myClock.punch = vi.fn(async () => ({ event: {} as never, duplicate: false }));
    renderWith(m);
    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: "O meu ponto" }));
    await user.click(await screen.findByRole("button", { name: "Pausa: Almoço" }));
    expect(screen.queryByRole("button", { name: "Pausa" })).not.toBeInTheDocument();
    await waitFor(() => expect(m.myClock.punch).toHaveBeenCalledWith(expect.objectContaining({ segmentType: "break_unpaid", breakTypeId: "b1" })));
  });

  it("catálogo de pausas: remuneração obrigatória ao criar; alterar exige motivo", async () => {
    const m = mod();
    const b = { id: "b1", name: "Café", color: "#0EA5E9", remuneration: "hybrid" as const, hybridPaidMinutes: 15, maxMinutes: null, windowStart: null, windowEnd: null, maxUsesPerDay: null, weekdays: null, archived: false, version: 2 };
    m.attendance.listBreakTypes = vi.fn(async () => [b]);
    m.attendance.createBreakType = vi.fn(async () => b);
    m.attendance.updateBreakType = vi.fn(async () => b);
    renderWith(m);
    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: "Pausas" }));
    expect(await screen.findByText("Primeiros 15 min pagos")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Nova pausa" }));
    let dialog = screen.getByRole("dialog");
    await user.type(within(dialog).getByLabelText("Nome"), "Almoço");
    expect(within(dialog).getByRole("button", { name: "Guardar" })).toBeDisabled();
    await user.click(within(dialog).getByRole("radio", { name: /^Não paga/ }));
    await user.click(within(dialog).getByRole("button", { name: "Guardar" }));
    expect(m.attendance.createBreakType).toHaveBeenCalledWith(expect.objectContaining({ name: "Almoço", remuneration: "unpaid", hybridPaidMinutes: null }));
    await user.click(await screen.findByRole("button", { name: "Alterar" }));
    dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("button", { name: "Guardar" })).toBeDisabled();
    await user.type(within(dialog).getByLabelText(/^Motivo da alteração/), "Acordo de empresa");
    await user.click(within(dialog).getByRole("button", { name: "Guardar" }));
    expect(m.attendance.updateBreakType).toHaveBeenCalledWith("b1", expect.objectContaining({ remuneration: "hybrid", hybridPaidMinutes: 15 }), 2, "Acordo de empresa");
  });

  it("tipos de registo (FE-105): começar formação/teletrabalho vai com o tipo; catálogo com remuneração obrigatória", async () => {
    const m = mod();
    const home = { id: "c2", name: "Teletrabalho", color: null, remote: true, remuneration: "paid" as const, hybridPaidMinutes: null, maxMinutesPerDay: null, blockedWeekdays: null, blockedHours: [], archived: false, version: 1 };
    m.myClock.status = vi.fn(async () => STATUS);
    m.myClock.clockTypes = vi.fn(async () => [home]);
    m.myClock.punch = vi.fn(async () => ({ event: {} as never, duplicate: false }));
    m.attendance.listClockTypes = vi.fn(async () => [home]);
    m.attendance.createClockType = vi.fn(async () => home);
    renderWith(m);
    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: "O meu ponto" }));
    await user.click(await screen.findByRole("button", { name: "Começar: Teletrabalho" }));
    await waitFor(() => expect(m.myClock.punch).toHaveBeenCalledWith(expect.objectContaining({ segmentType: "remote", clockTypeId: "c2" })));
    await user.click(screen.getByRole("tab", { name: "Tipos de registo" }));
    expect(await screen.findByText("Registo normal")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Novo tipo" }));
    const dialog = screen.getByRole("dialog");
    await user.type(within(dialog).getByLabelText("Nome"), "Formação");
    expect(within(dialog).getByRole("button", { name: "Guardar" })).toBeDisabled();
    await user.click(within(dialog).getByRole("radio", { name: /^Paga/ }));
    await user.click(within(dialog).getByRole("button", { name: "Sáb" }));
    await user.click(within(dialog).getByRole("button", { name: "Acrescentar faixa" }));
    await user.click(within(dialog).getByRole("button", { name: "Guardar" }));
    expect(m.attendance.createClockType).toHaveBeenCalledWith(expect.objectContaining({ name: "Formação", remuneration: "paid", blockedWeekdays: [6], blockedHours: [{ start: "12:00", end: "13:00" }] }));
  });

  it("RE_11_correcao_recusavel_aparece_com_o_prazo_e_recusa", async () => {
    const m = mod();
    m.myClock.status = vi.fn(async () => ({
      ...STATUS,
      refusable: [{ id: "r1", employeeId: "e1", operation: "update" as const, targetEventId: "ev1", occurredAt: null, segmentType: null, reason: "Entrou às 10h", author: "gestora", state: "active" as const, refusableUntil: "2026-10-14T09:00:00Z", anchorAt: "2026-10-09T08:00:00Z", createdAt: "2026-10-12T09:00:00Z" }],
    }));
    m.myClock.refuse = vi.fn(async () => ({}) as never);
    renderWith(m);
    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: "O meu ponto" }));
    expect(await screen.findByText(/Entrou às 10h.*Pode recusar até/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Recusar correção" }));
    expect(m.myClock.refuse).toHaveBeenCalledWith("r1", null);
  });

  it("conta sem ficha mostra o aviso do servidor", async () => {
    const m = mod();
    m.myClock.status = vi.fn(async () => {
      throw new ApiError("Esta conta não está ligada a uma ficha de colaborador.", 404);
    });
    renderWith(m);
    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: "O meu ponto" }));
    expect(await screen.findByText("Esta conta não está ligada a uma ficha de colaborador.")).toBeInTheDocument();
  });
});
