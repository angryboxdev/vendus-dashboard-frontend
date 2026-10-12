import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../../../../../lib/api.ts";
import type { RosterShift } from "../../../domain/entities/rosters.ts";
import { cellLabel, daysFrom, parseSegments, violationsOf } from "../../../domain/services/rosters.service.ts";
import { fakeNovoRhModule } from "../../../fake-module.test-utils.ts";
import { NovoRhProvider, type NovoRhModule } from "../../../novo-rh.module.tsx";
import { RostersView } from "./RostersView.tsx";

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
const state = { employeeId: "e1", workDate: "2026-10-19", kind: "shift" as const, segments: TPL.segments, templateId: "t1", onCall: false };
const PUBLISHED: RosterShift = { ...state, id: "s1", rosterId: "r1", deleted: false, dirty: false, published: state, publishedVersion: 1 };

const mod = () => {
  const m = fakeNovoRhModule({
    settings: { listEmployees: vi.fn(async () => [{ id: "e1", label: "Ana Teste" }, { id: "e2", label: "Bruno Teste" }]), listLocations: vi.fn(async () => [{ id: "l1", label: "Porto" }]) } as unknown as NovoRhModule["settings"],
  });
  m.rosters.listRosters = vi.fn(async () => [ROSTER]);
  m.rosters.listTemplates = vi.fn(async () => [TPL]);
  m.rosters.listShifts = vi.fn(async () => ({ roster: ROSTER, pending: 1, shifts: [PUBLISHED, { ...PUBLISHED, id: "s2", workDate: "2026-10-20", dirty: true, published: null, publishedVersion: null }] }));
  return m;
};

async function openRoster() {
  const user = userEvent.setup();
  await screen.findByRole("option", { name: "Loja Porto" });
  await user.selectOptions(screen.getByLabelText("Escala"), "r1");
  return user;
}

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
});

describe("Escalas — ecrãs", () => {
  it("RE_15_modelo_sem_nome_nao_se_cria_e_faixas_invalidas_avisam", async () => {
    const m = mod();
    m.rosters.createTemplate = vi.fn(async () => {
      throw new ApiError("Campo obrigatório", 400);
    });
    renderWith(m);
    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: "Modelos de turno" }));
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
    const warn = [{ rule: "min_rest" as const, severity: "warning" as const, employeeId: "e1", workDate: "2026-10-20", message: "Só 8h00 de descanso" }];
    m.rosters.publish = vi.fn(async (_id: string, o: { confirm: boolean }) => {
      if (!o.confirm) throw new ApiError("Há avisos", 409, { violations: warn });
      return { id: "p", version: 2, reason: null, confirmedWarnings: warn, changes: [], publishedBy: "x", createdAt: "2026-10-12T10:00:00Z" };
    });
    renderWith(m);
    const user = await openRoster();
    await user.click(await screen.findByRole("button", { name: "Publicar escala" }));
    expect(await screen.findByText("Ana Teste: Só 8h00 de descanso")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Publicar mesmo assim" }));
    expect(m.rosters.publish).toHaveBeenLastCalledWith("r1", { reason: null, confirm: true });
  });

  it("TK_16_alterar_turno_publicado_exige_motivo", async () => {
    const m = mod();
    m.rosters.updateShift = vi.fn(async () => ({ shift: PUBLISHED, warnings: [], publication: null }));
    renderWith(m);
    const user = await openRoster();
    await user.click(await screen.findByRole("button", { name: "Ana Teste 2026-10-19" }));
    await user.selectOptions(screen.getByLabelText("Ao clicar num dia vazio, pôr"), "t1");
    const box = screen.getByRole("group", { name: "Turno de Ana Teste em 2026-10-19" });
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
    await screen.findByRole("button", { name: "Ana Teste 2026-10-19" });
    await user.selectOptions(screen.getByLabelText("Ao clicar num dia vazio, pôr"), "t1");
    const empty = screen.getAllByRole("button", { name: /^Ana Teste 2026-/ }).find((b) => b.textContent === "")!;
    await user.click(empty);
    expect(m.rosters.addShift).toHaveBeenCalledWith("r1", expect.objectContaining({ employeeId: "e1", kind: "shift", templateId: "t1" }));
  });

  it("troca: aprovar e recusar só com comentário", async () => {
    const m = mod();
    m.rosters.listSwaps = vi.fn(async () => [{ id: "w1", shiftId: "s1", counterShiftId: null, requesterEmployeeId: "e1", targetEmployeeId: "e2", status: "pending_manager" as const, comment: "Consulta", createdAt: "2026-10-12T09:00:00Z" }]);
    m.rosters.decideSwap = vi.fn(async () => ({}) as never);
    renderWith(m);
    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: "Trocas" }));
    expect(await screen.findByRole("button", { name: "Recusar troca" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Aprovar troca" }));
    expect(m.rosters.decideSwap).toHaveBeenCalledWith("w1", "approve", null, true);
  });
});
