import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../../../../lib/api.ts";
import type { RosterShift } from "../../../domain/entities/rosters.ts";
import { weekOf } from "../../../domain/services/attendance.service.ts";
import { areaRows, chipLabel, hoursLabel, hoursLong, overlappingIds, rosterRows, segmentsTone, shiftRows, templateTone } from "../../../domain/services/roster-board.service.ts";
import { cellLabel, daysFrom, parseSegments, violationsOf } from "../../../domain/services/rosters.service.ts";
import { cellRect, copyInputs, paintInputs } from "../../../domain/services/roster-edit.service.ts";
import { afterRedo, afterUndo, emptyHistory, HISTORY_LIMIT, recordOp, type EditOp } from "../../../domain/services/edit-history.service.ts";
import { todayIn } from "../../../domain/services/settings-format.service.ts";
import { coverageConfigured, coverageDeficits, shortDay, windowLabel } from "../../../domain/services/roster-coverage.service.ts";
import { TOPICS, topicDefinitions } from "../../../domain/services/settings-topics.service.ts";
import type { CoverageReport } from "../../../domain/entities/rosters.ts";
import { fakeNovoRhModule } from "../../../fake-module.test-utils.ts";
import { NovoRhProvider, type NovoRhModule } from "../../../novo-rh.module.tsx";
import { RostersView } from "./RostersView.tsx";
import { CoveragePanel } from "./CoveragePanel.tsx";

// Datas da semana atual (a grelha abre na semana de hoje).
const MON = weekOf(todayIn()).from;
const TUE = daysFrom(MON, 2)[1]!;

function renderWith(m: NovoRhModule) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <NovoRhProvider module={m}>
        <MemoryRouter>
          <RostersView />
        </MemoryRouter>
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
  m.rosters.summary = vi.fn(async () => [{ roster: ROSTER, employeeIds: ["e1"], shifts: 2, pending: 1, lastPublishedAt: "2026-10-12T10:00:00Z" }]);
  m.rosters.listTemplates = vi.fn(async () => [TPL]);
  m.rosters.listShifts = vi.fn(async () => ({ roster: ROSTER, pending: 1, shifts: [PUBLISHED, { ...PUBLISHED, id: "s2", workDate: TUE, dirty: true, published: null, publishedVersion: null }] }));
  return m;
};

/** Abre na visão macro; escolher a escala abre a grelha. */
async function openRoster() {
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Loja Porto" }));
  await screen.findAllByRole("button", { name: `Ana Teste ${MON}` });
  return user;
}

const panel = () => screen.getByRole("complementary", { name: "Atribuir turnos" });
const grid = () => screen.getByRole("table", { name: "Turnos por dia" });
const dt = () => ({ setData: vi.fn(), effectAllowed: "", dropEffect: "" });

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
    // A cor escolhida no modelo manda (a mesma na escala); fora da paleta = automática.
    expect(templateTone({ name: "Dia", color: "#e2c470", segments: [{ start: "10:00", end: "20:00" }] })).toBe("night");
    expect(templateTone({ name: "Dia", color: "#ED5C32", segments: [{ start: "10:00", end: "20:00" }] })).toBe("morning");
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
    await openRoster();
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
    // Às segundas o cartão de hoje tem o mesmo nome: basta que um dos botões seja o avatar com foto.
    expect(screen.getAllByRole("button", { name: `Ana Teste ${MON}` }).some((b) => b.querySelector("img"))).toBe(true);
  });

  it("sem escalas: estado vazio com 'Nova escala'", async () => {
    const m = mod();
    m.rosters.listRosters = vi.fn(async () => []);
    m.rosters.summary = vi.fn(async () => []);
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
    // Horas no relógio (sem escrever): fim 1 igual ao início → faixa inválida.
    await user.click(within(box).getByRole("button", { name: "Fim 1: 17:00" }));
    const hours = screen.getByRole("listbox", { name: "Horas" });
    hours.focus();
    for (let i = 0; i < 8; i++) await user.keyboard("{ArrowUp}");
    expect(within(box).getByRole("button", { name: "Fim 1: 09:00" })).toBeInTheDocument();
    expect(screen.getByText(/Faixas inválidas/)).toBeInTheDocument();
    expect(within(box).getByRole("button", { name: "Criar modelo" })).toBeDisabled();
    await user.keyboard("{PageDown}");
    await user.click(screen.getByRole("option", { name: "15" }));
    expect(within(box).getByRole("button", { name: "Fim 1: 15:00" })).toBeInTheDocument();
    await user.click(within(box).getByRole("button", { name: "Adicionar faixa" }));
    expect(within(box).getByRole("button", { name: "Início 2: 15:00" })).toBeInTheDocument();
    expect(within(box).getByRole("button", { name: "Fim 2: 19:00" })).toBeInTheDocument();
    await user.click(within(box).getByRole("button", { name: "Criar modelo" }));
    expect(await screen.findByText("Campo obrigatório")).toBeInTheDocument();
    expect(m.rosters.createTemplate).toHaveBeenCalledWith(expect.objectContaining({ segments: [{ start: "09:00", end: "15:00" }, { start: "15:00", end: "19:00" }] }));
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
    // Aviso compacto junto à operação (uma ocorrência: por inteiro, com o colaborador e o dia).
    expect(await screen.findByText(`Ana Teste · ${TUE}`)).toBeInTheDocument();
    expect(screen.getByText("Só 8h00 de descanso")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Publicar mesmo assim" }));
    // Publica só a semana visível.
    expect(m.rosters.publish).toHaveBeenLastCalledWith("r1", { reason: null, confirm: true, from: MON, to: daysFrom(MON, 7)[6] });
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

  it("clicar num dia vazio escolhe-o; com um modelo escolhido, cria o turno (rascunho)", async () => {
    const m = mod();
    m.rosters.addShift = vi.fn(async () => ({ shift: PUBLISHED, warnings: [] }));
    renderWith(m);
    const user = await openRoster();
    const third = daysFrom(MON, 3)[2]!;
    const empty = () => within(grid()).getByRole("button", { name: `Ana Teste ${third}` });
    await user.click(empty());
    expect(empty()).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("1 dia(s) escolhido(s)")).toBeInTheDocument();
    expect(m.rosters.addShift).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Limpar escolha" }));
    await user.click(within(panel()).getByRole("button", { name: /Tarde/ }));
    await user.click(empty());
    expect(m.rosters.addShift).toHaveBeenCalledWith("r1", expect.objectContaining({ employeeId: "e1", workDate: third, kind: "shift", templateId: "t1" }));
    expect(await screen.findByText("1 turno atribuídos (por publicar).")).toBeInTheDocument();
  });

  it("Ctrl+C no turno e Ctrl+V nos dias escolhidos copia-o (mesmo modelo)", async () => {
    const m = mod();
    m.rosters.addShift = vi.fn(async () => ({ shift: PUBLISHED, warnings: [] }));
    renderWith(m);
    const user = await openRoster();
    const [, , wed, thu] = daysFrom(MON, 4);
    const source = within(grid()).getByRole("button", { name: `Ana Teste ${MON}` });
    await user.hover(source);
    await user.keyboard("{Control>}c{/Control}");
    expect(screen.getByText(/Turno copiado: Ana Teste/)).toBeInTheDocument();
    await user.unhover(source);
    await user.click(within(grid()).getByRole("button", { name: `Ana Teste ${wed}` }));
    await user.keyboard("{Control>}");
    await user.click(within(grid()).getByRole("button", { name: `Ana Teste ${thu}` }));
    await user.keyboard("{/Control}");
    expect(screen.getByText("2 dia(s) escolhido(s)")).toBeInTheDocument();
    await user.keyboard("{Control>}v{/Control}");
    await vi.waitFor(() => expect(m.rosters.addShift).toHaveBeenCalledTimes(2));
    expect(m.rosters.addShift).toHaveBeenCalledWith("r1", { employeeId: "e1", workDate: wed, kind: "shift", templateId: "t1", segments: [], areaId: null });
    expect(m.rosters.addShift).toHaveBeenCalledWith("r1", { employeeId: "e1", workDate: thu, kind: "shift", templateId: "t1", segments: [], areaId: null });
  });

  it("arrastar um turno para outro dia pergunta mover/copiar; mover cria no novo dia e retira o original", async () => {
    const m = mod();
    m.rosters.addShift = vi.fn(async () => ({ shift: PUBLISHED, warnings: [] }));
    m.rosters.deleteShift = vi.fn(async () => ({ publication: null }));
    renderWith(m);
    const user = await openRoster();
    const wed = daysFrom(MON, 3)[2]!;
    const card = within(grid()).getByRole("button", { name: `Ana Teste ${TUE}` }).parentElement!;
    const cell = (d: string) => within(grid()).getByRole("button", { name: `Ana Teste ${d}` }).closest<HTMLElement>("[role=cell]")!;
    const data = dt();
    fireEvent.dragStart(card, { dataTransfer: data });
    fireEvent.dragEnter(cell(wed), { dataTransfer: data });
    expect(cell(wed)).toHaveAttribute("data-selected", "true");
    fireEvent.drop(cell(wed), { dataTransfer: data });
    // A escolha aparece na própria célula onde se largou.
    const choice = within(cell(wed)).getByRole("group", { name: "Mover ou copiar o turno" });
    await user.click(within(choice).getByRole("button", { name: "Mover" }));
    await vi.waitFor(() => expect(m.rosters.deleteShift).toHaveBeenCalledWith("s2", { reason: null, confirm: false }));
    expect(m.rosters.addShift).toHaveBeenCalledWith("r1", { employeeId: "e1", workDate: wed, kind: "shift", templateId: "t1", segments: [], areaId: null });
  });

  it("arrastar por vários dias pinta-os e copia para todos; um turno publicado só se move com motivo", async () => {
    const m = mod();
    m.rosters.addShift = vi.fn(async () => ({ shift: PUBLISHED, warnings: [] }));
    renderWith(m);
    const user = await openRoster();
    const [, , wed, thu, fri] = daysFrom(MON, 5);
    const card = () => within(grid()).getByRole("button", { name: `Ana Teste ${MON}` }).parentElement!;
    const cell = (d: string) => within(grid()).getByRole("button", { name: `Ana Teste ${d}` }).closest<HTMLElement>("[role=cell]")!;
    const data = dt();
    fireEvent.dragStart(card(), { dataTransfer: data });
    fireEvent.dragEnter(cell(wed), { dataTransfer: data });
    fireEvent.dragEnter(cell(fri), { dataTransfer: data });
    expect(cell(thu)).toHaveAttribute("data-selected", "true");
    fireEvent.drop(cell(fri), { dataTransfer: data });
    const box = within(cell(fri)).getByRole("group", { name: "Mover ou copiar o turno" });
    expect(within(box).queryByRole("button", { name: "Mover" })).toBeNull();
    await user.click(within(box).getByRole("button", { name: "Copiar (3)" }));
    await vi.waitFor(() => expect(m.rosters.addShift).toHaveBeenCalledTimes(3));
    // Um só dia, turno publicado: mover pede motivo.
    fireEvent.dragStart(card(), { dataTransfer: data });
    fireEvent.dragEnter(cell(wed), { dataTransfer: data });
    fireEvent.drop(cell(wed), { dataTransfer: data });
    await user.click(within(within(cell(wed)).getByRole("group", { name: "Mover ou copiar o turno" })).getByRole("button", { name: "Mover" }));
    const one = screen.getByRole("dialog", { name: "T de Ana Teste" });
    expect(within(one).getByRole("button", { name: "Mover turno" })).toBeDisabled();
    await user.type(within(one).getByLabelText(/Motivo/), "Troca pedida");
    expect(within(one).getByRole("button", { name: "Mover turno" })).toBeEnabled();
  });

  it("Ctrl+C com texto selecionado é a cópia normal do browser (não copia o turno)", async () => {
    renderWith(mod());
    const user = await openRoster();
    const spy = vi.spyOn(window, "getSelection").mockReturnValue({ toString: () => "texto" } as unknown as Selection);
    await user.hover(within(grid()).getByRole("button", { name: `Ana Teste ${MON}` }));
    await user.keyboard("{Control>}c{/Control}");
    expect(screen.queryByText(/Turno copiado/)).toBeNull();
    spy.mockRestore();
  });

  it("copiar para vários dias salta os que já têm turno e diz quantos", async () => {
    const m = mod();
    m.rosters.addShift = vi.fn(async () => ({ shift: PUBLISHED, warnings: [] }));
    renderWith(m);
    const user = await openRoster();
    const [, , wed, thu] = daysFrom(MON, 4);
    const card = within(grid()).getByRole("button", { name: `Ana Teste ${MON}` }).parentElement!;
    const cell = (d: string) => within(grid()).getAllByRole("button", { name: `Ana Teste ${d}` })[0]!.closest<HTMLElement>("[role=cell]")!;
    const data = dt();
    fireEvent.dragStart(card, { dataTransfer: data });
    fireEvent.dragEnter(cell(TUE), { dataTransfer: data });
    fireEvent.dragEnter(cell(thu), { dataTransfer: data });
    fireEvent.drop(cell(thu), { dataTransfer: data });
    await user.click(within(within(cell(thu)).getByRole("group", { name: "Mover ou copiar o turno" })).getByRole("button", { name: "Copiar (3)" }));
    await vi.waitFor(() => expect(m.rosters.addShift).toHaveBeenCalledTimes(2));
    expect(m.rosters.addShift).not.toHaveBeenCalledWith("r1", expect.objectContaining({ workDate: TUE }));
    expect(m.rosters.addShift).toHaveBeenCalledWith("r1", expect.objectContaining({ workDate: wed }));
    expect(await screen.findByText(/1 dia com turno ignorado/)).toBeInTheDocument();
  });

  it("visão macro: escalas com local, funcionários, estado e última publicação; escolher abre a grelha", async () => {
    renderWith(mod());
    const row = (await screen.findByRole("button", { name: "Loja Porto" })).closest("tr")!;
    expect(within(row).getByText("Porto")).toBeInTheDocument();
    expect(within(row).getByText("1")).toBeInTheDocument();
    expect(within(row).getByText("Pendente")).toBeInTheDocument();
    expect(within(row).getByText("12/10/2026")).toBeInTheDocument();
    expect(screen.getByText("1 escala(s)")).toBeInTheDocument();
    await userEvent.setup().click(within(row).getByRole("button", { name: "Loja Porto" }));
    expect(await screen.findByRole("table", { name: "Turnos por dia" })).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Todas as escalas" }));
    expect(await screen.findByRole("button", { name: "Loja Porto" })).toBeInTheDocument();
  });

  it("se o resumo falhar, as escalas aparecem na mesma (sem pessoas/estado) com o erro à vista", async () => {
    const m = mod();
    m.rosters.summary = vi.fn(async () => {
      throw new ApiError("Erro interno", 500);
    });
    renderWith(m);
    expect(await screen.findByText(/Não foi possível obter o resumo das escalas/)).toBeInTheDocument();
    expect(screen.getByText("500 · Erro interno")).toBeInTheDocument();
    await userEvent.setup().click(await screen.findByRole("button", { name: "Loja Porto" }));
    expect(await screen.findByRole("table", { name: "Turnos por dia" })).toBeInTheDocument();
  });

  it("turnos sobrepostos (vindos de antes) ficam assinalados; a API recusa novos", async () => {
    const m = mod();
    m.rosters.listShifts = vi.fn(async () => ({ roster: ROSTER, pending: 1, shifts: [PUBLISHED, { ...PUBLISHED, id: "s9", dirty: true, published: null, publishedVersion: null }] }));
    renderWith(m);
    await openRoster();
    expect(within(grid()).getAllByText("Sobreposto a outro turno")).toHaveLength(2);
    expect(overlappingIds([PUBLISHED, { ...PUBLISHED, id: "x", segments: [{ start: "22:00", end: "23:00" }], templateId: null }], [TPL]).size).toBe(0);
  });

  it("histórico: deltas mínimos, máx. 30, nova ação limpa o refazer", () => {
    const op = (id: string): EditOp => ({ type: "REMOVE_SHIFT", affectedIds: [id], inversePayload: { byEmployee: { e1: [id] }, from: MON, to: TUE } });
    let h = emptyHistory();
    for (let i = 0; i < HISTORY_LIMIT + 5; i++) h = recordOp(h, op(`s${i}`));
    expect(h.undo).toHaveLength(HISTORY_LIMIT);
    h = afterUndo(h);
    expect(h.redo).toHaveLength(1);
    h = afterRedo(h);
    expect(h.redo).toHaveLength(0);
    h = afterUndo(h);
    expect(recordOp(h, op("novo")).redo).toEqual([]);
  });

  it("atribuir com o modelo escolhido: pré-visualização junto ao cursor, Desfazer retira e Refazer repõe; Esc cancela", async () => {
    const m = mod();
    const created = { ...PUBLISHED, id: "n1", workDate: daysFrom(MON, 3)[2]!, published: null, publishedVersion: null, dirty: true };
    m.rosters.addShift = vi.fn(async () => ({ shift: created, warnings: [] }));
    m.rosters.clearPending = vi.fn(async () => ({ removed: [created] }));
    m.rosters.restoreShifts = vi.fn(async () => ({ restored: [created], warnings: [] }));
    renderWith(m);
    const user = await openRoster();
    const third = daysFrom(MON, 3)[2]!;
    const undo = screen.getByRole("button", { name: "Desfazer" });
    const redo = screen.getByRole("button", { name: "Refazer" });
    expect(undo).toBeDisabled();
    await user.click(within(panel()).getByRole("button", { name: /Tarde/ }));
    expect(document.querySelector('[data-testid="placement-preview"]')).not.toBeNull();
    await user.click(within(grid()).getByRole("button", { name: `Ana Teste ${third}` }));
    await vi.waitFor(() => expect(undo).toBeEnabled());
    expect(m.rosters.addShift).toHaveBeenCalledTimes(1);
    await user.click(undo);
    await vi.waitFor(() => expect(m.rosters.clearPending).toHaveBeenCalledWith("r1", expect.objectContaining({ employeeId: "e1", shiftIds: ["n1"] })));
    await vi.waitFor(() => expect(redo).toBeEnabled());
    await user.click(redo);
    await vi.waitFor(() => expect(m.rosters.restoreShifts).toHaveBeenCalledWith("r1", ["n1"]));
    await user.keyboard("{Escape}");
    expect(document.querySelector('[data-testid="placement-preview"]')).toBeNull();
  });

  it("× só nos turnos pendentes; remove sem confirmação e pode desfazer-se", async () => {
    const m = mod();
    m.rosters.deleteShift = vi.fn(async () => ({ publication: null }));
    m.rosters.restoreShifts = vi.fn(async () => ({ restored: [], warnings: [] }));
    renderWith(m);
    const user = await openRoster();
    const published = within(grid()).getByRole("button", { name: `Ana Teste ${MON}` }).parentElement!;
    const draft = within(grid()).getByRole("button", { name: `Ana Teste ${TUE}` }).parentElement!;
    expect(within(published).queryByRole("button", { name: "Remover turno" })).toBeNull();
    await user.click(within(draft).getByRole("button", { name: "Remover turno" }));
    await vi.waitFor(() => expect(m.rosters.deleteShift).toHaveBeenCalledWith("s2", { reason: null, confirm: false }));
    expect(screen.queryByRole("dialog")).toBeNull();
    const undo = screen.getByRole("button", { name: "Desfazer" });
    await vi.waitFor(() => expect(undo).toBeEnabled());
    await user.click(undo);
    await vi.waitFor(() => expect(m.rosters.restoreShifts).toHaveBeenCalledWith("r1", ["s2"]));
  });

  it("linha da pessoa: nome é link para a ficha; menu (célula ou ⋯) limpa os pendentes da semana numa só chamada", async () => {
    const m = mod();
    m.rosters.clearPending = vi.fn(async () => ({ removed: [{ ...PUBLISHED, id: "s2" }] }));
    m.rosters.restoreShifts = vi.fn(async () => ({ restored: [], warnings: [] }));
    renderWith(m);
    const user = await openRoster();
    expect(within(grid()).getByRole("link", { name: "Ana Teste" })).toHaveAttribute("href", "/hr/novo/pessoas/e1");
    await user.click(within(grid()).getByRole("button", { name: "Opções de Ana Teste" }));
    await user.click(screen.getByRole("menuitem", { name: "Limpar turnos pendentes da semana" }));
    const box = screen.getByRole("dialog", { name: "Limpar turnos pendentes da semana?" });
    expect(box).toHaveTextContent("Serão removidos 1 turno(s) ainda não publicados de Ana Teste");
    await user.click(within(box).getByRole("button", { name: "Limpar turnos" }));
    const sun = daysFrom(MON, 7)[6]!;
    await vi.waitFor(() => expect(m.rosters.clearPending).toHaveBeenCalledTimes(1));
    expect(m.rosters.clearPending).toHaveBeenCalledWith("r1", { employeeId: "e1", from: MON, to: sun });
    await user.click(screen.getByRole("button", { name: "Desfazer" }));
    await vi.waitFor(() => expect(m.rosters.restoreShifts).toHaveBeenCalledWith("r1", ["s2"]));
  });

  it("publicar com sucesso limpa o histórico de edição", async () => {
    const m = mod();
    m.rosters.deleteShift = vi.fn(async () => ({ publication: null }));
    m.rosters.publish = vi.fn(async () => ({ id: "p", version: 2, reason: null, confirmedWarnings: [], changes: [], publishedBy: "x", createdAt: "2026-10-13T10:00:00Z" }));
    renderWith(m);
    const user = await openRoster();
    await user.click(within(within(grid()).getByRole("button", { name: `Ana Teste ${TUE}` }).parentElement!).getByRole("button", { name: "Remover turno" }));
    const undo = screen.getByRole("button", { name: "Desfazer" });
    await vi.waitFor(() => expect(undo).toBeEnabled());
    await user.click(screen.getByRole("button", { name: "Publicar escala" }));
    await user.click(await screen.findByRole("button", { name: "Publicar agora" }));
    await vi.waitFor(() => expect(undo).toBeDisabled());
  });

  it("regras da edição direta: retângulo de células, cópia sem a própria célula, pintura", () => {
    const rect = cellRect(["e1", "e2"], [MON, TUE], { employeeId: "e2", workDate: TUE }, { employeeId: "e1", workDate: MON });
    expect(rect).toHaveLength(4);
    expect(copyInputs(PUBLISHED, [{ employeeId: "e1", workDate: MON }, { employeeId: "e2", workDate: MON }, { employeeId: "e2", workDate: MON }])).toEqual([
      { employeeId: "e2", workDate: MON, kind: "shift", templateId: "t1", segments: [], areaId: null },
    ]);
    expect(paintInputs("day_off", [{ employeeId: "e1", workDate: TUE }])).toEqual([{ employeeId: "e1", workDate: TUE, kind: "day_off", templateId: null, segments: [], areaId: null }]);
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

describe("Escalas — seletor inteligente e conflitos", () => {
  const OVERLAP = {
    rule: "overlap" as const,
    severity: "block" as const,
    employeeId: "e1",
    workDate: TUE,
    message: "Horário indisponível: já tem um turno na escala «Centro Braga» (16:00–22:00). Sobreposição entre 16:00 e 22:00.",
    shiftId: "s2",
    rosterId: "r1",
    conflict: { shiftId: "s9", rosterId: "r2", rosterName: "Centro Braga", workDate: TUE, hours: "16:00–22:00", published: true },
    overlap: "16:00–22:00",
  };

  it("adicionar colaboradores: centro primeiro (já na escala marcado), outros centros recolhidos, pesquisa em todos, vários de uma vez", async () => {
    const m = mod();
    m.settings.listEmployees = vi.fn(async () => [
      { id: "e1", label: "Ana Teste" },
      { id: "e2", label: "Bruno Teste" },
      { id: "e3", label: "Carla Teste" },
    ]);
    m.people.list = vi.fn(async () => [
      { id: "e1", primaryLocationId: "l1" },
      { id: "e2", primaryLocationId: "l1" },
      { id: "e3", primaryLocationId: "l2" },
    ]) as never;
    m.rosters.candidates = vi.fn(async () => ({ roster: { id: "r1", targetType: "location" as const, targetId: "l1" }, members: [], busy: [] }));
    renderWith(m);
    const user = await openRoster();
    await user.click(screen.getByRole("button", { name: "Adicionar colaborador à grelha" }));
    const center = await screen.findByRole("region", { name: "Porto" });
    expect(within(center).getByRole("checkbox", { name: "Ana Teste" })).toBeDisabled(); // já está na escala
    expect(screen.getByRole("button", { name: /Outros centros/ })).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("checkbox", { name: "Carla Teste" })).toBeNull();
    await user.type(screen.getByRole("searchbox", { name: "Pesquisar colaborador ou centro..." }), "carla");
    await user.click(await screen.findByRole("checkbox", { name: "Carla Teste" }));
    await user.clear(screen.getByRole("searchbox", { name: "Pesquisar colaborador ou centro..." }));
    await user.click(within(screen.getByRole("region", { name: "Porto" })).getByRole("checkbox", { name: "Bruno Teste" }));
    await user.click(screen.getByRole("button", { name: "Adicionar (2)" }));
    expect(await within(grid()).findAllByText("Carla Teste")).not.toHaveLength(0);
    expect(within(grid()).getAllByText("Bruno Teste")).not.toHaveLength(0);
    expect(m.rosters.candidates).toHaveBeenCalledWith("r1", MON, daysFrom(MON, 7)[6]);
  });

  it("turno sobreposto: aviso junto à operação com o turno incompatível; nada de lista gigante", async () => {
    const m = mod();
    m.rosters.addShift = vi.fn(async () => {
      throw new ApiError("A escala não cumpre restrições obrigatórias.", 422, { violations: [{ ...OVERLAP, shiftId: null }] });
    });
    renderWith(m);
    const user = await openRoster();
    const wed = daysFrom(MON, 3)[2]!;
    await user.click(within(panel()).getByRole("button", { name: /Tarde/ }));
    await user.click(within(grid()).getByRole("button", { name: `Ana Teste ${wed}` }));
    expect(await screen.findByText("Horário indisponível — Ana Teste")).toBeInTheDocument();
    expect(screen.getByText(/Sobreposição entre 16:00 e 22:00/)).toBeInTheDocument();
    const notice = screen.getByText("Horário indisponível — Ana Teste").closest<HTMLElement>("[role=alert]")!;
    expect(within(notice).getByRole("button", { name: "Ver turno existente" })).toBeInTheDocument();
    expect(screen.queryByText(/Não é possível publicar/)).toBeNull();
    await user.click(within(notice).getByRole("button", { name: "Fechar" }));
    expect(screen.queryByText("Horário indisponível — Ana Teste")).toBeNull();
  });

  it("conflitos da semana: contador na barra, painel agrupado por colaborador e «Abrir turno» abre a edição", async () => {
    const m = mod();
    m.rosters.check = vi.fn(async () => ({ pending: 1, violations: [OVERLAP, { ...OVERLAP, workDate: MON, shiftId: "s1" }] }));
    renderWith(m);
    const user = await openRoster();
    await user.click(await screen.findByRole("button", { name: "2 avisos na escala" }));
    await user.click(await screen.findByRole("button", { name: "Ver conflitos" }));
    const drawer = await screen.findByRole("dialog", { name: "Conflitos da escala" });
    expect(within(drawer).getByText(/2 ocorrências · 1 colaborador afetado/)).toBeInTheDocument();
    expect(within(drawer).getByRole("region", { name: "Ana Teste" })).toBeInTheDocument();
    expect(m.rosters.check).toHaveBeenCalledWith("r1", { from: MON, to: daysFrom(MON, 7)[6] });
    await user.click(within(drawer).getAllByRole("button", { name: "Abrir turno" })[0]!);
    expect(await screen.findByRole("dialog", { name: /Ana Teste/ })).toBeInTheDocument();
  });
});

describe("Escalas — criar turnos sem esperar pelo servidor", () => {
  it("o turno aparece logo («a guardar»); publicar enquanto grava pede para aguardar; no fim fica o turno do servidor", async () => {
    const m = mod();
    let resolve: (v: { shift: RosterShift; warnings: never[] }) => void = () => {};
    const wed = daysFrom(MON, 3)[2]!;
    m.rosters.addShift = vi.fn(() => new Promise<{ shift: RosterShift; warnings: never[] }>((r) => (resolve = r)));
    m.rosters.publish = vi.fn(async () => ({}) as never);
    renderWith(m);
    const user = await openRoster();
    await user.click(within(panel()).getByRole("button", { name: /Tarde/ }));
    await user.click(within(grid()).getByRole("button", { name: `Ana Teste ${wed}` }));
    // Já na grelha, antes de o servidor responder.
    expect(within(grid()).getAllByRole("button", { name: `Ana Teste ${wed}` }).some((b) => b.textContent?.includes("Tarde"))).toBe(true);
    expect(screen.getByText("A guardar 1…")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Publicar escala" }));
    await user.click(await screen.findByRole("button", { name: "Publicar agora" }));
    expect(await screen.findByText("Aguarde: ainda há 1 turno a guardar.")).toBeInTheDocument();
    expect(m.rosters.publish).not.toHaveBeenCalled();
    resolve({ shift: { ...PUBLISHED, id: "s9", workDate: wed, dirty: true, published: null, publishedVersion: null }, warnings: [] });
    await vi.waitFor(() => expect(screen.queryByText("A guardar 1…")).toBeNull());
    expect(screen.queryByText(/Aguarde: ainda há/)).toBeNull();
  });
});

describe("Escalas — turnos a guardar e em conflito ficam visíveis", () => {
  const OVER = (workDate: string) => ({
    rule: "overlap" as const,
    severity: "block" as const,
    employeeId: "e1",
    workDate,
    message: "Horário indisponível: já tem um turno na escala «Centro Braga». Sobreposição entre 16:00 e 22:00.",
    shiftId: null,
    rosterId: "r1",
    conflict: { shiftId: "x9", rosterId: "r2", rosterName: "Centro Braga", workDate, hours: "16:00–22:00", published: true },
    overlap: "16:00–22:00",
  });
  const card = (d: string) => within(grid()).getAllByRole("button", { name: `Ana Teste ${d}` }).find((b) => b.textContent?.includes("Tarde"));

  it("um turno a guardar não desaparece quando outro lote termina e a grelha recarrega", async () => {
    const m = mod();
    const [, , wed, thu] = daysFrom(MON, 4);
    const waiting: Record<string, (v: { shift: RosterShift; warnings: never[] }) => void> = {};
    m.rosters.addShift = vi.fn((_r: string, i: { workDate: string }) => new Promise<{ shift: RosterShift; warnings: never[] }>((r) => (waiting[i.workDate] = r)));
    renderWith(m);
    const user = await openRoster();
    await user.click(within(panel()).getByRole("button", { name: /Tarde/ }));
    await user.click(within(grid()).getByRole("button", { name: `Ana Teste ${wed}` }));
    await user.click(within(grid()).getByRole("button", { name: `Ana Teste ${thu}` }));
    expect(card(wed!)).toBeTruthy();
    expect(card(thu!)).toBeTruthy();
    // O primeiro lote grava e a grelha recarrega (o servidor ainda não tem o segundo).
    await vi.waitFor(() => expect(waiting[wed!]).toBeDefined());
    const saved = { ...PUBLISHED, id: "s-wed", workDate: wed!, dirty: true, published: null, publishedVersion: null };
    m.rosters.listShifts = vi.fn(async () => ({ roster: ROSTER, pending: 2, shifts: [PUBLISHED, saved] }));
    waiting[wed!]!({ shift: saved, warnings: [] });
    await vi.waitFor(() => expect(waiting[thu!]).toBeDefined());
    // O de quinta continua na grelha enquanto grava.
    expect(card(thu!)).toBeTruthy();
    expect(card(wed!)).toBeTruthy();
  });

  it("turnos recusados por conflito ficam na grelha a vermelho; retirar um desce logo o contador", async () => {
    const m = mod();
    const [, , wed, thu, fri] = daysFrom(MON, 5);
    m.rosters.addShift = vi.fn(async (_r: string, i: { workDate: string }) => {
      throw new ApiError("A escala não cumpre restrições obrigatórias.", 422, { violations: [OVER(i.workDate)] });
    });
    renderWith(m);
    const user = await openRoster();
    await user.click(within(panel()).getByRole("button", { name: /Tarde/ }));
    for (const d of [wed, thu, fri]) await user.click(within(grid()).getByRole("button", { name: `Ana Teste ${d}` }));
    await vi.waitFor(() => expect(screen.getByText("3 conflitos encontrados")).toBeInTheDocument());
    for (const d of [wed, thu, fri]) expect(card(d!)!.getAttribute("title")).toMatch(/em conflito/);
    await user.click(within(card(thu!)!.parentElement!).getByRole("button", { name: "Remover turno" }));
    expect(screen.getByText("2 conflitos encontrados")).toBeInTheDocument();
    expect(card(thu!)).toBeUndefined();
    expect(m.rosters.deleteShift).not.toHaveBeenCalled();
  });

  it("retirar um turno real em conflito tira-o logo do contador de avisos da barra", async () => {
    const m = mod();
    m.rosters.check = vi.fn(async () => ({ pending: 1, violations: [{ ...OVER(TUE), shiftId: "s2", conflict: { ...OVER(TUE).conflict } }] }));
    let finish: () => void = () => {};
    m.rosters.deleteShift = vi.fn(() => new Promise<never>(() => (finish = () => {})));
    renderWith(m);
    const user = await openRoster();
    expect(await screen.findByRole("button", { name: "1 avisos na escala" })).toBeInTheDocument();
    await user.click(within(within(grid()).getByRole("button", { name: `Ana Teste ${TUE}` }).parentElement!).getByRole("button", { name: "Remover turno" }));
    // Ainda sem resposta do servidor, o contador já desceu.
    expect(await screen.findByRole("button", { name: "Sem avisos na escala" })).toBeInTheDocument();
    finish();
  });
});

describe("Escalas — áreas de trabalho", () => {
  const SALA = { id: "a1", locationId: "l1", name: "Sala", sortOrder: 0, active: true };
  const CAIXA = { id: "a2", locationId: "l1", name: "Caixa", sortOrder: 1, active: true };
  const VELHA = { id: "a3", locationId: "l1", name: "Esplanada", sortOrder: 2, active: false };
  const withAreas = () => {
    const m = mod();
    m.rosters.listAreas = vi.fn(async () => [SALA, CAIXA, VELHA]);
    m.rosters.listShifts = vi.fn(async () => ({ roster: ROSTER, pending: 1, shifts: [{ ...PUBLISHED, areaId: "a2" }, { ...PUBLISHED, id: "s2", workDate: TUE, dirty: true, published: null, publishedVersion: null }] }));
    return m;
  };

  it("regras: área vai com a cópia e com o pincel (folga nunca); agrupar por área com «Sem área» no fim", () => {
    expect(copyInputs({ ...PUBLISHED, areaId: "a1" }, [{ employeeId: "e2", workDate: MON }])[0]!.areaId).toBe("a1");
    expect(paintInputs("t1", [{ employeeId: "e1", workDate: TUE }], "a2")[0]!.areaId).toBe("a2");
    expect(paintInputs("day_off", [{ employeeId: "e1", workDate: TUE }], "a2")[0]!.areaId).toBeNull();
    const day = { ...PUBLISHED, id: "d1", kind: "day_off" as const, segments: [], templateId: null };
    const rows = areaRows([{ ...PUBLISHED, areaId: "a2" }, { ...PUBLISHED, id: "x", areaId: "a3" }, { ...PUBLISHED, id: "y" }, day], [CAIXA, VELHA, SALA], [TPL]);
    // Ativas pela ordem (mesmo vazias), desativada só com turnos, «Sem área» no fim; folgas fora.
    expect(rows.map((r) => [r.label, [...r.byDate.values()].flat().length])).toEqual([["Sala", 0], ["Caixa", 1], ["Esplanada", 1], ["Sem área", 1]]);
    expect(areaRows([], [VELHA], []).map((r) => r.key)).toEqual(["none"]);
  });

  it("vista «Áreas»: uma linha por área do centro e os turnos sem área em «Sem área»", async () => {
    renderWith(withAreas());
    const user = await openRoster();
    await user.click(screen.getByRole("radio", { name: "Áreas" }));
    expect(await screen.findByText("Áreas de trabalho")).toBeInTheDocument();
    const rowOf = (label: string) => screen.getAllByRole("row").find((r) => within(r).queryByText(label))!;
    expect(within(rowOf("Caixa")).getByRole("button", { name: `Ana Teste · Tarde ${MON}` })).toBeInTheDocument();
    expect(within(rowOf("Sem área")).getByRole("button", { name: `Ana Teste · Tarde ${TUE}` })).toBeInTheDocument();
    expect(rowOf("Sala")).toBeTruthy();
    // Desativada e sem turnos: não aparece.
    expect(screen.queryByText("Esplanada")).toBeNull();
  });

  it("pincel com área: o turno criado leva a área escolhida; só áreas ativas do centro", async () => {
    const m = withAreas();
    m.rosters.addShift = vi.fn(async () => ({ shift: PUBLISHED, warnings: [] }));
    renderWith(m);
    const user = await openRoster();
    expect(m.rosters.listAreas).toHaveBeenCalledWith("l1");
    const areas = await within(panel()).findByRole("group", { name: "Área de trabalho" });
    expect(within(areas).queryByRole("button", { name: "Esplanada" })).toBeNull();
    await user.click(within(areas).getByRole("button", { name: "Sala" }));
    await user.click(within(panel()).getByRole("button", { name: /Tarde/ }));
    const third = daysFrom(MON, 3)[2]!;
    await user.click(within(grid()).getByRole("button", { name: `Ana Teste ${third}` }));
    expect(m.rosters.addShift).toHaveBeenCalledWith("r1", expect.objectContaining({ workDate: third, templateId: "t1", areaId: "a1" }));
  });

  it("mudar a área de um turno publicado: só com motivo, como as outras alterações", async () => {
    const m = withAreas();
    m.rosters.updateShift = vi.fn(async () => ({ shift: PUBLISHED, warnings: [], publication: null }));
    renderWith(m);
    const user = await openRoster();
    await user.click(screen.getAllByRole("button", { name: `Ana Teste ${MON}` })[0]!);
    const box = screen.getByRole("dialog", { name: `Turno de Ana Teste em ${MON}` });
    const select = await within(box).findByLabelText("Área de trabalho");
    expect(select).toHaveValue("a2");
    await user.selectOptions(select, "a1");
    const change = within(box).getByRole("button", { name: "Alterar para o modelo escolhido" });
    expect(change).toBeDisabled();
    await user.type(within(box).getByLabelText(/Motivo/), "Reforço na sala");
    await user.click(change);
    expect(m.rosters.updateShift).toHaveBeenCalledWith("s1", { areaId: "a1" }, { reason: "Reforço na sala", confirm: false });
  });

  it("gerir áreas por centro: criar, ordenar, mudar o nome e desativar", async () => {
    const m = withAreas();
    m.rosters.createArea = vi.fn(async () => ({ ...SALA, id: "a9", name: "Cozinha", sortOrder: 3 }));
    m.rosters.updateArea = vi.fn(async () => SALA);
    renderWith(m);
    const user = await openRoster();
    await user.click(within(panel()).getByRole("button", { name: "Gerir áreas" }));
    const list = await screen.findByRole("list", { name: "Áreas de trabalho" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(3);
    expect(within(list).getAllByRole("listitem")[2]).toHaveTextContent("Desativada");
    expect(screen.getByRole("button", { name: "Subir Sala" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Descer Sala" }));
    expect(m.rosters.updateArea).toHaveBeenCalledWith("a1", { sortOrder: 1 });
    expect(m.rosters.updateArea).toHaveBeenCalledWith("a2", { sortOrder: 0 });
    await user.click(screen.getByRole("button", { name: "Desativar Caixa" }));
    expect(m.rosters.updateArea).toHaveBeenCalledWith("a2", { active: false });
    await user.click(screen.getByRole("button", { name: "Reativar Esplanada" }));
    expect(m.rosters.updateArea).toHaveBeenCalledWith("a3", { active: true });
    await user.click(screen.getByRole("button", { name: "Mudar o nome Sala" }));
    const input = within(list).getByLabelText("Nome da área");
    await user.clear(input);
    await user.type(input, "Sala principal");
    await user.click(within(list).getByRole("button", { name: "Guardar" }));
    expect(m.rosters.updateArea).toHaveBeenCalledWith("a1", { name: "Sala principal" });
    const add = screen.getByRole("form", { name: "Adicionar área" });
    await user.type(within(add).getByLabelText("Nome da área"), "Cozinha");
    await user.click(within(add).getByRole("button", { name: "Adicionar área" }));
    expect(m.rosters.createArea).toHaveBeenCalledWith({ locationId: "l1", name: "Cozinha" });
  });
});

describe("Escalas — plano de cobertura", () => {
  const W = { startsNextDay: false, endsNextDay: false, published: 0 };
  const REPORT: CoverageReport = {
    enabled: true,
    locationId: "l1",
    days: [
      { date: TUE, areaId: "a1", status: "deficit", windows: [{ ...W, start: "12:00", end: "15:00", required: 3, planned: 1 }] },
      { date: MON, areaId: null, status: "deficit", windows: [{ ...W, start: "09:00", end: "13:00", required: 2, planned: 2 }, { ...W, start: "13:00", end: "17:00", required: 2, planned: 1 }] },
      { date: MON, areaId: "a1", status: "not_configured", windows: [] },
    ],
  };
  const withCoverage = () => {
    const m = mod();
    m.rosters.listAreas = vi.fn(async () => [{ id: "a1", locationId: "l1", name: "Sala", sortOrder: 0, active: true }]);
    m.rosters.coverageStatus = vi.fn(async () => ({ enabled: true }));
    m.rosters.coverage = vi.fn(async () => REPORT);
    return m;
  };

  it("regras do ecrã: défices por dia (centro antes das áreas), intervalos a passar a meia-noite, tema Funcionalidades", () => {
    expect(coverageDeficits(REPORT).map((d) => [d.date, d.areaId, d.window.start, d.missing])).toEqual([
      [MON, null, "13:00", 1],
      [TUE, "a1", "12:00", 2],
    ]);
    expect(coverageDeficits({ ...REPORT, enabled: false })).toEqual([]);
    expect(coverageConfigured(REPORT)).toBe(true);
    expect(coverageConfigured({ ...REPORT, days: [REPORT.days[2]!] })).toBe(false);
    expect(windowLabel({ start: "22:00", end: "02:00", startsNextDay: false, endsNextDay: true })).toBe("22:00–02:00 (+1)");
    expect(windowLabel({ start: "01:00", end: "06:00", startsNextDay: true, endsNextDay: true })).toBe("01:00–06:00 (dia seguinte)");
    expect(shortDay("2026-11-02")).toBe("seg 02/11");
    const def = { key: "time_tracking.roster.coverage_enabled", domain: "time_tracking" } as never;
    const rest = { key: "time_tracking.roster.rest_severity", domain: "time_tracking" } as never;
    const topic = (k: string) => TOPICS.find((x) => x.key === k)!;
    expect(topicDefinitions(topic("features"), [def, rest])).toEqual([def]);
    expect(topicDefinitions(topic("rosters"), [def, rest])).toEqual([rest]);
  });

  it("desligado (por omissão): sem alertas, sem pedido de cobertura e sem entrada no menu", async () => {
    const m = mod();
    renderWith(m);
    const user = await openRoster();
    await user.click(screen.getByRole("button", { name: "Adicionar" }));
    expect(screen.queryByRole("menuitem", { name: "Plano de cobertura" })).toBeNull();
    expect(m.rosters.coverage).not.toHaveBeenCalled();
    expect(screen.queryByText(/abaixo do mínimo de cobertura/)).toBeNull();
  });

  it("ligado: alerta com os défices da semana; publicar avisa mas não bloqueia", async () => {
    const m = withCoverage();
    m.rosters.publish = vi.fn(async () => ({ id: "p", version: 2, reason: null, confirmedWarnings: [], changes: [], publishedBy: "x", createdAt: "2026-10-12T10:00:00Z" }));
    renderWith(m);
    const user = await openRoster();
    expect(await screen.findByText("2 intervalo(s) abaixo do mínimo de cobertura")).toBeInTheDocument();
    const list = screen.getByRole("list", { name: "Plano de cobertura" });
    expect(within(list).getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      `${shortDay(MON)} · Centro inteiro · 13:00–17:00 — 1 de 2`,
      `${shortDay(TUE)} · Sala · 12:00–15:00 — 1 de 3`,
    ]);
    expect(m.rosters.coverage).toHaveBeenCalledWith("r1", MON, daysFrom(MON, 7)[6]);
    await user.click(screen.getByRole("button", { name: "Publicar escala" }));
    expect(await screen.findByText(/Atenção: 2 intervalo\(s\) deste período/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Publicar agora" }));
    expect(m.rosters.publish).toHaveBeenCalled();
  });

  it("gerir mínimos: semanal cria uma regra por dia escolhido; exceção numa data; alterar o mínimo e apagar", async () => {
    const m = withCoverage();
    const RULE = { id: "c1", locationId: "l1", areaId: null, weekday: 1, date: null, start: "09:00", end: "17:00", minPeople: 2 };
    const EXC = { id: "c2", locationId: "l1", areaId: null, weekday: null, date: "2026-12-24", start: "22:00", end: "02:00", minPeople: 4 };
    m.rosters.listCoverageRules = vi.fn(async () => [RULE, EXC]);
    m.rosters.createCoverageRule = vi.fn(async (x) => ({ ...x, id: "n" }));
    m.rosters.updateCoverageRule = vi.fn(async () => RULE);
    m.rosters.deleteCoverageRule = vi.fn(async () => undefined);
    renderWith(m);
    const user = await openRoster();
    await user.click(screen.getByRole("button", { name: "Adicionar" }));
    await user.click(screen.getByRole("menuitem", { name: "Plano de cobertura" }));
    const monday = await screen.findByRole("list", { name: "Segunda" });
    expect(monday).toHaveTextContent("09:00–17:00mín. 2");
    expect(screen.getAllByText("Não configurado")).toHaveLength(6);
    expect(within(screen.getByRole("list", { name: "Exceções" })).getByText("2026-12-24")).toBeInTheDocument();
    expect(screen.getByText("22:00–02:00 (+1)")).toBeInTheDocument();

    await user.click(within(monday).getByRole("button", { name: "Alterar o mínimo de 09:00–17:00" }));
    const min = within(monday).getByLabelText("Mínimo de pessoas");
    await user.clear(min);
    await user.type(min, "3");
    await user.click(within(monday).getByRole("button", { name: "Guardar" }));
    expect(m.rosters.updateCoverageRule).toHaveBeenCalledWith("c1", { minPeople: 3 });
    await user.click(screen.getByRole("button", { name: "Apagar a regra de 2026-12-24 22:00–02:00 (+1)" }));
    expect(m.rosters.deleteCoverageRule).toHaveBeenCalledWith("c2");

    // Novo mínimo semanal para a Sala, só ao sábado e domingo.
    await user.selectOptions(screen.getByLabelText("Âmbito"), "a1");
    const form = screen.getByRole("form", { name: "Adicionar mínimo" });
    for (const d of ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"]) await user.click(within(form).getByLabelText(d));
    await user.click(within(form).getByRole("button", { name: "Adicionar mínimo" }));
    expect(m.rosters.createCoverageRule).toHaveBeenCalledTimes(2);
    expect(m.rosters.createCoverageRule).toHaveBeenCalledWith({ locationId: "l1", areaId: "a1", weekday: 6, date: null, start: "12:00", end: "15:00", minPeople: 2 });
    expect(m.rosters.createCoverageRule).toHaveBeenCalledWith(expect.objectContaining({ weekday: 7 }));
    // Exceção numa data.
    await user.click(within(form).getByLabelText("Exceção numa data"));
    fireEvent.change(within(form).getByLabelText("Data"), { target: { value: "2026-12-31" } });
    await user.click(within(form).getByRole("button", { name: "Adicionar mínimo" }));
    expect(m.rosters.createCoverageRule).toHaveBeenLastCalledWith({ locationId: "l1", areaId: "a1", weekday: null, date: "2026-12-31", start: "12:00", end: "15:00", minPeople: 2 });
  });

  it("painel com a funcionalidade desligada: explica e leva às Funcionalidades (sem pedir regras)", async () => {
    const m = mod();
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <NovoRhProvider module={m}>
          <MemoryRouter>
            <CoveragePanel />
          </MemoryRouter>
        </NovoRhProvider>
      </QueryClientProvider>,
    );
    expect(await screen.findByText("O plano de cobertura está desligado")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Abrir Funcionalidades" })).toHaveAttribute("href", "/hr/novo/configuracoes?tema=features");
    expect(m.rosters.listCoverageRules).not.toHaveBeenCalled();
  });
});
