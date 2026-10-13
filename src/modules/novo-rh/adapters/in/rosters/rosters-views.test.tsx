import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../../../../lib/api.ts";
import type { RosterShift } from "../../../domain/entities/rosters.ts";
import { weekOf } from "../../../domain/services/attendance.service.ts";
import { chipLabel, hoursLabel, hoursLong, rosterRows, segmentsTone, shiftRows, templateTone } from "../../../domain/services/roster-board.service.ts";
import { cellLabel, daysFrom, parseSegments, violationsOf } from "../../../domain/services/rosters.service.ts";
import { todayIn } from "../../../domain/services/settings-format.service.ts";
import { fakeNovoRhModule } from "../../../fake-module.test-utils.ts";
import { NovoRhProvider, type NovoRhModule } from "../../../novo-rh.module.tsx";
import { RostersView } from "./RostersView.tsx";

// Datas da semana atual (a grelha abre na semana de hoje).
const MON = weekOf(todayIn()).from;
const TUE = daysFrom(MON, 2)[1]!;

function renderWith(m: NovoRhModule) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <NovoRhProvider module={m}>
        <RostersView />
      </NovoRhProvider>
    </QueryClientProvider>,
  );
}

const ROSTER = { id: "r1", name: "Loja Porto", targetType: "location" as const, targetId: "l1", version: 1, archived: false };
const TPL = { id: "t1", name: "Tarde", abbreviation: "T", color: "#ED5C32", onCall: false, segments: [{ start: "16:00", end: "22:00" }], archived: false };
const state = { employeeId: "e1", workDate: MON, kind: "shift" as const, segments: TPL.segments, templateId: "t1", onCall: false };
const PUBLISHED: RosterShift = { ...state, id: "s1", rosterId: "r1", deleted: false, dirty: false, published: state, publishedVersion: 1 };

const mod = () => {
  const m = fakeNovoRhModule({
    settings: { listEmployees: vi.fn(async () => [{ id: "e1", label: "Ana Teste", photoUrl: "https://foto/ana.jpg" }, { id: "e2", label: "Bruno Teste" }]), listLocations: vi.fn(async () => [{ id: "l1", label: "Porto" }]) } as unknown as NovoRhModule["settings"],
  });
  m.rosters.listRosters = vi.fn(async () => [ROSTER]);
  m.rosters.listTemplates = vi.fn(async () => [TPL]);
  m.rosters.listShifts = vi.fn(async () => ({ roster: ROSTER, pending: 1, shifts: [PUBLISHED, { ...PUBLISHED, id: "s2", workDate: TUE, dirty: true, published: null, publishedVersion: null }] }));
  return m;
};

/** A escala abre já escolhida (a primeira); espera pela grelha. */
async function openRoster() {
  const user = userEvent.setup();
  await screen.findAllByRole("button", { name: `Ana Teste ${MON}` });
  return user;
}

const panel = () => screen.getByRole("complementary", { name: "Atribuir turnos" });

beforeEach(() => localStorage.clear());

describe("Escalas — regras do ecrã", () => {
  it("faixas, rótulos e violações vindas da API", () => {
    expect(parseSegments("09:00-13:00, 14:00-18:00")).toEqual([{ start: "09:00", end: "13:00" }, { start: "14:00", end: "18:00" }]);
    expect(parseSegments("9h-13h")).toBeNull();
    expect(cellLabel({ kind: "shift", segments: [], templateId: "t1" }, [TPL])).toBe("T");
    expect(cellLabel({ kind: "day_off", segments: [], templateId: null }, [TPL])).toBe("F");
    expect(daysFrom("2026-10-19", 3)).toEqual(["2026-10-19", "2026-10-20", "2026-10-21"]);
    const v = [{ rule: "min_rest" as const, severity: "warning" as const, employeeId: "e1", workDate: "2026-10-20", message: "x" }];
    expect(violationsOf(new ApiError("x", 409, { violations: v }))).toEqual({ kind: "confirm", violations: v });
    expect(violationsOf(new ApiError("x", 422, { violations: v }))?.kind).toBe("blocked");
  });

  it("Design System: tipo e cor do turno, horas, chip e linhas", () => {
    expect(segmentsTone([{ start: "09:00", end: "15:00" }])).toBe("morning");
    expect(segmentsTone([{ start: "22:00", end: "04:00" }])).toBe("night");
    expect(segmentsTone([{ start: "09:00", end: "14:00" }, { start: "15:00", end: "18:30" }])).toBe("split");
    expect(templateTone({ name: "Serviço", segments: [{ start: "09:30", end: "14:30" }] })).toBe("other");
    expect(hoursLabel(510)).toBe("8h 30min");
    expect(chipLabel({ abbreviation: "", name: "manhã" })).toBe("Man");
    const rows = rosterRows([PUBLISHED], ["e2"], [{ id: "e1", label: "Ana Teste" }, { id: "e2", label: "Bruno Teste" }], [TPL], { search: "", sort: "asc" });
    expect(rows.map((r) => [r.name, r.minutes])).toEqual([["Ana Teste", 360], ["Bruno Teste", 0]]);
    expect(rosterRows([PUBLISHED], [], [{ id: "e1", label: "Ána Teste" }], [TPL], { search: "ana", sort: "asc" })).toHaveLength(1);
    expect(hoursLong(3600)).toBe("60h 00min");
    const off = { ...PUBLISHED, id: "s3", kind: "day_off" as const, templateId: null, segments: [] };
    const byShift = shiftRows([PUBLISHED, { ...PUBLISHED, id: "s2", employeeId: "e2" }, off], [TPL]);
    expect(byShift.map((r) => [r.key, r.label, r.minutes, r.byDate.get(MON)?.length])).toEqual([["t1", "Tarde", 720, 2], ["day_off", "Folga", 0, 1]]);
  });
});

describe("Escalas — ecrãs", () => {
  it("título, escala já escolhida, grelha da semana, rascunho e painel de atribuição", async () => {
    renderWith(mod());
    expect(screen.getByRole("heading", { level: 1, name: "Escalas & Turnos" })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /Escala: Loja Porto/ })).toBeInTheDocument();
    const card = (await screen.findAllByRole("button", { name: `Ana Teste ${MON}` }))[0]!;
    expect(card).toHaveTextContent("Tarde");
    expect(card).toHaveTextContent("16:00 - 22:00");
    expect(screen.getAllByRole("button", { name: `Ana Teste ${TUE}` })[0]).toHaveTextContent("(rascunho)");
    expect(screen.getByText("1 por publicar")).toBeInTheDocument();
    expect(within(panel()).getByText("T")).toBeInTheDocument();
  });

  it("foto redonda ao lado do nome; vista por turnos com as fotos de quem faz o turno", async () => {
    renderWith(mod());
    await openRoster();
    const row = screen.getAllByRole("row").find((r) => within(r).queryByText("Ana Teste"))!;
    expect(row.querySelector('img[src="https://foto/ana.jpg"]')).not.toBeNull();
    expect(screen.getAllByText("1 pessoa atribuída • 0 ocultos").length).toBeGreaterThan(0);
    const user = userEvent.setup();
    await user.click(screen.getByRole("radio", { name: "Turnos" }));
    expect(await screen.findByText("Turnos da escala")).toBeInTheDocument();
    expect(screen.getByText("1 turnos atribuídos")).toBeInTheDocument();
    expect(screen.getByText("12h 00min")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: `Ana Teste ${MON}` })[0]!.querySelector("img")).not.toBeNull();
  });

  it("sem escalas: estado vazio com 'Nova escala'", async () => {
    const m = mod();
    m.rosters.listRosters = vi.fn(async () => []);
    renderWith(m);
    expect(await screen.findByText("Ainda não há escalas nesta organização")).toBeInTheDocument();
    await userEvent.setup().click(screen.getAllByRole("button", { name: "Nova escala" })[0]!);
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("RE_15_modelo_sem_nome_nao_se_cria_e_faixas_invalidas_avisam", async () => {
    const m = mod();
    m.rosters.createTemplate = vi.fn(async () => {
      throw new ApiError("Campo obrigatório", 400);
    });
    renderWith(m);
    const user = await openRoster();
    // Modelos de turno abrem em "Configurações" no painel "Atribuir turnos".
    await user.click(within(panel()).getByRole("button", { name: "Configurações" }));
    const box = await screen.findByRole("group", { name: "Criar modelo" });
    await user.type(within(box).getByLabelText("Faixas (ex.: 09:00-13:00, 14:00-18:00)"), "9h");
    expect(screen.getByText(/Faixas inválidas/)).toBeInTheDocument();
    await user.clear(within(box).getByLabelText("Faixas (ex.: 09:00-13:00, 14:00-18:00)"));
    await user.type(within(box).getByLabelText("Faixas (ex.: 09:00-13:00, 14:00-18:00)"), "16:00-22:00");
    await user.click(within(box).getByRole("button", { name: "Criar modelo" }));
    expect(await screen.findByText("Campo obrigatório")).toBeInTheDocument();
  });

  it("RE_16_publicar_com_avisos_pede_confirmacao_e_repete_com_confirm", async () => {
    const m = mod();
    const warn = [{ rule: "min_rest" as const, severity: "warning" as const, employeeId: "e1", workDate: TUE, message: "Só 8h00 de descanso" }];
    m.rosters.publish = vi.fn(async (_id: string, o: { confirm: boolean }) => {
      if (!o.confirm) throw new ApiError("Há avisos", 409, { violations: warn });
      return { id: "p", version: 2, reason: null, confirmedWarnings: warn, changes: [], publishedBy: "x", createdAt: "2026-10-12T10:00:00Z" };
    });
    renderWith(m);
    const user = await openRoster();
    await user.click(screen.getByRole("button", { name: "Publicar escala" }));
    await user.click(await screen.findByRole("button", { name: "Publicar agora" }));
    expect(await screen.findByText("Ana Teste: Só 8h00 de descanso")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Publicar mesmo assim" }));
    expect(m.rosters.publish).toHaveBeenLastCalledWith("r1", { reason: null, confirm: true });
  });

  it("TK_16_alterar_turno_publicado_exige_motivo", async () => {
    const m = mod();
    m.rosters.updateShift = vi.fn(async () => ({ shift: PUBLISHED, warnings: [], publication: null }));
    renderWith(m);
    const user = await openRoster();
    await user.click(screen.getAllByRole("button", { name: `Ana Teste ${MON}` })[0]!);
    // O modelo escolhe-se em "Atribuir turnos".
    await user.click(within(panel()).getByRole("button", { name: /Tarde/ }));
    const box = screen.getByRole("dialog", { name: `Turno de Ana Teste em ${MON}` });
    const change = within(box).getByRole("button", { name: "Alterar para o modelo escolhido" });
    expect(change).toBeDisabled();
    await user.type(within(box).getByLabelText(/Motivo/), "Pedido da loja");
    await user.click(change);
    expect(m.rosters.updateShift).toHaveBeenCalledWith("s1", { kind: "shift", templateId: "t1" }, { reason: "Pedido da loja", confirm: false });
  });

  it("clicar num dia vazio cria o turno do modelo escolhido (rascunho)", async () => {
    const m = mod();
    m.rosters.addShift = vi.fn(async () => ({ shift: PUBLISHED, warnings: [] }));
    renderWith(m);
    const user = await openRoster();
    const third = daysFrom(MON, 3)[2]!;
    expect(screen.getAllByRole("button", { name: `Ana Teste ${third}` })[0]).toBeDisabled();
    await user.click(within(panel()).getByRole("button", { name: /Tarde/ }));
    await user.click(screen.getAllByRole("button", { name: `Ana Teste ${third}` })[0]!);
    expect(m.rosters.addShift).toHaveBeenCalledWith("r1", expect.objectContaining({ employeeId: "e1", workDate: third, kind: "shift", templateId: "t1" }));
  });

  it("troca: aprovar e recusar só com comentário", async () => {
    const m = mod();
    m.rosters.listSwaps = vi.fn(async () => [{ id: "w1", shiftId: "s1", counterShiftId: null, requesterEmployeeId: "e1", targetEmployeeId: "e2", status: "pending_manager" as const, comment: "Consulta", createdAt: "2026-10-12T09:00:00Z" }]);
    m.rosters.decideSwap = vi.fn(async () => ({}) as never);
    renderWith(m);
    const user = await openRoster();
    await user.click(screen.getByRole("button", { name: "Adicionar" }));
    await user.click(screen.getByRole("menuitem", { name: "Trocas" }));
    expect(await screen.findByRole("button", { name: "Recusar troca" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Aprovar troca" }));
    expect(m.rosters.decideSwap).toHaveBeenCalledWith("w1", "approve", null, true);
  });
});
