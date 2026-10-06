import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../../../../lib/api.ts";
import type { ShiftTemplate, ShiftTemplateGroup, ShiftTemplatePayload } from "../../domain/entities/shift-template.ts";
import type { HrApiPort } from "../../domain/ports/out/hr-api.port.ts";
import { HrProvider, type HrModule } from "../../hr.module.tsx";
import { SetEmployeeKioskPinUseCase } from "../../application/use-cases/set-employee-kiosk-pin.use-case.ts";
import { ShiftTemplatesPanel } from "./ShiftTemplatesPanel.tsx";

/** Objetos estáveis entre renders (ver nota no teste de LocationsAdminView). */
const auth = vi.hoisted(() => ({
  value: { user: { id: "u1", email: "gestor@exemplo.pt", role: "manager" as "admin" | "manager" | "hr_viewer", organizationId: "org", access: null }, loading: false },
}));
vi.mock("../../../../contexts/AuthContext.tsx", () => ({ useAuth: () => auth.value }));
const locationsState = vi.hoisted(() => ({ locations: [{ id: "loc-mbs", name: "Mercado Bom Sucesso", isActive: true }] }));
vi.mock("../../../locations/adapters/in/use-locations.ts", () => ({ useLocations: () => locationsState }));

function setRole(role: "manager" | "hr_viewer") {
  auth.value = { ...auth.value, user: { ...auth.value.user, role } };
}

function toTemplate(id: string, p: ShiftTemplatePayload, active = true): ShiftTemplate {
  const work = 480; // a lista só mostra o valor vindo do backend
  return { id, ...p, kind: p.secondStartTime ? "split" : "direct", workMinutes: work, spanMinutes: work, active, updatedAt: "" };
}

const base = (name: string, group: ShiftTemplateGroup, start: string, end: string): ShiftTemplatePayload => ({
  name,
  group,
  description: null,
  color: "#3B82F6",
  startTime: start,
  endTime: end,
  endsNextDay: end <= start,
  secondStartTime: null,
  secondEndTime: null,
  breakMinutes: 0,
  locationId: "loc-mbs",
});

// Dados fictícios.
const ABERTURA = toTemplate("t1", base("Abertura 1", "OPENING", "10:00", "18:00"));
const FECHO3 = toTemplate("t2", base("Fecho 3", "CLOSING", "20:00", "23:00"));
const FECHO4 = toTemplate("t3", base("Fecho 4", "CLOSING", "20:00", "00:00"));
const REP = toTemplate("t4", { ...base("Intermédio repartido", "INTERMEDIATE", "11:00", "15:00"), secondStartTime: "19:00", secondEndTime: "23:00" });
const ANTIGO = toTemplate("t5", base("Fecho antigo", "CLOSING", "19:00", "23:00"), false);

/** API falsa só com o que o painel usa; reproduz o 409 de nome duplicado. */
function renderPanel(seed: ShiftTemplate[]) {
  let templates = [...seed];
  const api = {
    listShiftTemplates: async () => templates,
    createShiftTemplate: vi.fn(async (p: ShiftTemplatePayload) => {
      if (templates.some((t) => t.name.toLowerCase() === p.name.toLowerCase())) throw new ApiError(`Já existe um modelo de turno com o nome "${p.name}"`, 409);
      const created = toTemplate(`t${templates.length + 1}`, p);
      templates = [...templates, created];
      return created;
    }),
    updateShiftTemplate: async () => templates[0]!,
    setShiftTemplateActive: async (id: string, active: boolean) => {
      templates = templates.map((t) => (t.id === id ? { ...t, active } : t));
      return templates.find((t) => t.id === id)!;
    },
    listEmployees: async () => ({ items: [], total: 0 }),
    listPositions: async () => [],
  } as unknown as HrApiPort;
  const mod: HrModule = { api, setEmployeeKioskPin: new SetEmployeeKioskPinUseCase(api) };
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <HrProvider module={mod}>
        <ShiftTemplatesPanel />
      </HrProvider>
    </QueryClientProvider>,
  );
  return api;
}

const rowNames = () => screen.queryAllByRole("row").map((r) => within(r).queryByText(/^(Abertura 1|Fecho 3|Fecho 4|Intermédio repartido|Fecho antigo)$/)?.textContent).filter(Boolean);

describe("ShiftTemplatesPanel — biblioteca (Modelos de Turno 2.0)", () => {
  it("em Todos organiza por Grupo (secções recolhíveis) e mostra só Ativos por omissão", async () => {
    setRole("manager");
    renderPanel([ABERTURA, FECHO3, FECHO4, REP, ANTIGO]);
    const user = userEvent.setup();

    expect(await screen.findByRole("button", { name: /Abertura · 1/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Fecho · 2/ })).toBeInTheDocument();
    expect(screen.queryByText("Fecho antigo")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Fecho · 2/ }));
    expect(screen.queryByText("Fecho 3")).not.toBeInTheDocument();
    expect(screen.getByText("Abertura 1")).toBeInTheDocument();
  });

  it("filtros: Grupo Fecho, Fecho + Repartido, Inativos; pesquisa por horário 20:00", async () => {
    setRole("manager");
    renderPanel([ABERTURA, FECHO3, FECHO4, REP, ANTIGO]);
    const user = userEvent.setup();
    await screen.findByText("Abertura 1");

    await user.click(within(screen.getByRole("group", { name: "Grupo" })).getByRole("button", { name: "Fecho" }));
    expect(rowNames()).toEqual(["Fecho 3", "Fecho 4"]);

    await user.selectOptions(screen.getByLabelText("Tipo"), "split");
    expect(screen.getByText("Nenhum modelo corresponde aos filtros.")).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Tipo"), "");

    await user.selectOptions(screen.getByLabelText("Estado"), "inactive");
    expect(rowNames()).toEqual(["Fecho antigo"]);
    await user.selectOptions(screen.getByLabelText("Estado"), "active");

    await user.click(within(screen.getByRole("group", { name: "Grupo" })).getByRole("button", { name: "Todos" }));
    await user.type(screen.getByLabelText("Pesquisar modelos"), "20:00");
    expect(rowNames()).toEqual(["Fecho 3", "Fecho 4"]);
  });

  it("Novo modelo dentro de Fecho começa com Grupo Fecho; em Todos começa com Outro", async () => {
    setRole("manager");
    const api = renderPanel([ABERTURA]);
    const user = userEvent.setup();
    await screen.findByText("Abertura 1");

    await user.click(screen.getByRole("button", { name: "Novo modelo" }));
    expect(within(screen.getByRole("dialog", { name: "Novo modelo de turno" })).getByLabelText("Grupo")).toHaveValue("OTHER");
    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    await user.click(within(screen.getByRole("group", { name: "Grupo" })).getByRole("button", { name: "Fecho" }));
    await user.click(screen.getByRole("button", { name: "Novo modelo" }));
    const dialog = screen.getByRole("dialog", { name: "Novo modelo de turno" });
    expect(within(dialog).getByLabelText("Grupo")).toHaveValue("CLOSING");
    await user.type(within(dialog).getByLabelText(/Nome do modelo/), "Fecho 5");
    await user.click(within(dialog).getByRole("button", { name: "Guardar modelo" }));
    expect(api.createShiftTemplate).toHaveBeenCalledWith(expect.objectContaining({ name: "Fecho 5", group: "CLOSING" }));
  });

  it("Duplicar (no ⋮) copia Grupo/Tipo/horários/Local; nome duplicado mostra o erro e mantém o modal", async () => {
    setRole("manager");
    renderPanel([REP]);
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Mais ações de Intermédio repartido" }));
    await user.click(screen.getByRole("menuitem", { name: "Duplicar" }));
    const dialog = screen.getByRole("dialog", { name: "Duplicar modelo de turno" });
    expect(within(dialog).getByLabelText("Grupo")).toHaveValue("INTERMEDIATE");
    expect(within(dialog).getByLabelText(/Início do 2.º período/)).toHaveValue("19:00");
    const name = within(dialog).getByLabelText(/Nome do modelo/);
    expect(name).toHaveValue("Intermédio repartido (cópia)");
    await user.clear(name);
    await user.type(name, "intermédio repartido");
    await user.click(within(dialog).getByRole("button", { name: "Guardar modelo" }));
    expect(await within(dialog).findByText("Já existe um modelo com este nome.")).toBeInTheDocument();
  });

  it("Aplicar na linha abre o fluxo com esse modelo pré-selecionado", async () => {
    setRole("manager");
    renderPanel([ABERTURA, FECHO3]);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Aplicar Fecho 3" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Fecho 3 — 20:00 – 23:00")).toBeInTheDocument();
  });

  it("perfil só-leitura não vê ações", async () => {
    setRole("hr_viewer");
    renderPanel([ABERTURA]);
    expect(await screen.findByText("Abertura 1")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Novo modelo" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Mais ações/ })).not.toBeInTheDocument();
  });
});
