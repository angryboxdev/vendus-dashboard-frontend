import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../../../../../lib/api.ts";
import type { ShiftTemplate } from "../../../domain/entities/rosters.ts";
import { fakeNovoRhModule } from "../../../fake-module.test-utils.ts";
import { NovoRhProvider, type NovoRhModule } from "../../../novo-rh.module.tsx";
import { TemplatesPanel } from "./OtherPanels.tsx";

// Modelos fictícios: um nunca usado, um usado (repartido) e um noturno usado.
const LIVRE: ShiftTemplate = { id: "t1", name: "Tarde", abbreviation: "T", color: null, onCall: false, segments: [{ start: "16:00", end: "22:00" }], archived: false, used: false };
const USADO: ShiftTemplate = { id: "t2", name: "Repartido", abbreviation: "R", color: "#8CCCAC", onCall: true, segments: [{ start: "10:00", end: "14:00" }, { start: "18:00", end: "22:00" }], archived: false, used: true };
const NOITE: ShiftTemplate = { id: "t3", name: "Noturno", abbreviation: "N", color: null, onCall: false, segments: [{ start: "22:00", end: "06:00" }], archived: false, used: true };
const ARQ: ShiftTemplate = { ...LIVRE, id: "t9", name: "Antigo", abbreviation: "A", archived: true };

function setup() {
  const m: NovoRhModule = fakeNovoRhModule();
  m.rosters.listTemplates = vi.fn(async () => [LIVRE, USADO, NOITE, ARQ]);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <NovoRhProvider module={m}>
        <TemplatesPanel />
      </NovoRhProvider>
    </QueryClientProvider>,
  );
  return { m, user: userEvent.setup() };
}

const row = (name: string) => screen.getByRole("cell", { name: new RegExp(name) }).closest("tr")!;

describe("Modelos de turno — gestão (V2)", () => {
  it("tabela com exatamente 4 colunas, sem «Estado» nem arquivados; repartidos e noturnos legíveis", async () => {
    setup();
    await screen.findByText("Repartido");
    expect(screen.getAllByRole("columnheader").map((h) => h.textContent)).toEqual(["Abreviatura", "Nome do turno", "Horário(s)", "Ações"]);
    expect(screen.queryByText(/Estado/)).toBeNull();
    expect(screen.queryByText("Antigo")).toBeNull();
    expect(within(row("Repartido")).getByText("10:00–14:00")).toBeInTheDocument();
    expect(within(row("Repartido")).getByText("18:00–22:00")).toBeInTheDocument();
    expect(within(row("Noturno")).getByLabelText("Termina no dia seguinte")).toBeInTheDocument();
    // Ações: só o botão ···, sem «Editar»/«Arquivar» à vista.
    expect(screen.queryByRole("button", { name: "Arquivar" })).toBeNull();
    expect(screen.getAllByRole("button", { name: /^Ações de / })).toHaveLength(3);
  });

  it("cor: nunca usado abre a paleta no quadrado; usado mostra a cor bloqueada com explicação acessível", async () => {
    const { m, user } = setup();
    m.rosters.setTemplateColor = vi.fn(async () => ({ ...LIVRE, color: "#96BAE4" }));
    await user.click(await screen.findByRole("button", { name: "Mudar a cor de Tarde" }));
    await user.click(within(screen.getByRole("dialog", { name: "Cor de Tarde" })).getByRole("button", { name: "Tarde" }));
    expect(m.rosters.setTemplateColor).toHaveBeenCalledWith("t1", "#96BAE4");
    expect(screen.queryByRole("button", { name: "Mudar a cor de Repartido" })).toBeNull();
    const locked = within(row("Repartido")).getByText("R").closest("[tabindex]")!;
    expect(locked).toHaveAccessibleDescription("Cor bloqueada: turno já utilizado numa escala.");
  });

  it("Editar preenche o formulário; guardar num modelo usado cria nova versão e avisa", async () => {
    const { m, user } = setup();
    m.rosters.updateTemplate = vi.fn(async () => ({ template: { ...USADO, id: "t2b", name: "Repartido longo" }, versioned: true }));
    await user.click(await screen.findByRole("button", { name: "Ações de Repartido" }));
    await user.click(screen.getByRole("menuitem", { name: "Editar" }));
    const box = screen.getByRole("group", { name: "Editar turno" });
    expect(within(box).getByLabelText("Nome")).toHaveValue("Repartido");
    expect(within(box).getByLabelText("Abreviatura")).toHaveValue("R");
    expect(screen.getByText(/As escalas existentes mantêm o horário anterior/)).toBeInTheDocument();
    await user.clear(within(box).getByLabelText("Nome"));
    await user.type(within(box).getByLabelText("Nome"), "Repartido longo");
    await user.click(within(box).getByRole("button", { name: "Guardar alterações" }));
    expect(m.rosters.updateTemplate).toHaveBeenCalledWith("t2", expect.objectContaining({ name: "Repartido longo", abbreviation: "R", onCall: true, segments: USADO.segments }));
    expect(await screen.findByRole("status")).toHaveTextContent("As escalas já feitas mantêm o turno anterior.");
    expect(screen.getByRole("group", { name: "Criar modelo" })).toBeInTheDocument();
  });

  it("erro ao guardar (ex.: 409) mantém o que foi escrito; Cancelar volta a «Criar novo turno»", async () => {
    const { m, user } = setup();
    m.rosters.updateTemplate = vi.fn(async () => {
      throw new ApiError("Este turno acabou de ser usado numa escala. Guarda outra vez para criar uma nova versão.", 409);
    });
    await user.click(await screen.findByRole("button", { name: "Ações de Tarde" }));
    await user.click(screen.getByRole("menuitem", { name: "Editar" }));
    const box = screen.getByRole("group", { name: "Editar turno" });
    await user.clear(within(box).getByLabelText("Nome"));
    await user.type(within(box).getByLabelText("Nome"), "Tarde nova");
    await user.click(within(box).getByRole("button", { name: "Guardar alterações" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("acabou de ser usado");
    expect(within(box).getByLabelText("Nome")).toHaveValue("Tarde nova");
    await user.click(within(box).getByRole("button", { name: "Cancelar" }));
    expect(screen.getByRole("heading", { name: "Criar novo turno" })).toBeInTheDocument();
    expect(within(screen.getByRole("group", { name: "Criar modelo" })).getByLabelText("Nome")).toHaveValue("");
  });

  it("Desativar pede confirmação e só depois arquiva", async () => {
    const { m, user } = setup();
    m.rosters.archiveTemplate = vi.fn(async () => {});
    await user.click(await screen.findByRole("button", { name: "Ações de Noturno" }));
    await user.click(screen.getByRole("menuitem", { name: "Desativar" }));
    const dialog = screen.getByRole("dialog", { name: "Desativar «Noturno»?" });
    expect(m.rosters.archiveTemplate).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole("button", { name: "Desativar" }));
    expect(m.rosters.archiveTemplate).toHaveBeenCalledWith("t3");
  });
});
