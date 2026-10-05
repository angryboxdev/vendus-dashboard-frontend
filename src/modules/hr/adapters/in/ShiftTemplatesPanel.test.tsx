import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../../../../lib/api.ts";
import type { ShiftTemplate, ShiftTemplatePayload } from "../../domain/entities/shift-template.ts";
import type { HrApiPort } from "../../domain/ports/out/hr-api.port.ts";
import { HrProvider, type HrModule } from "../../hr.module.tsx";
import { SetEmployeeKioskPinUseCase } from "../../application/use-cases/set-employee-kiosk-pin.use-case.ts";
import { ShiftTemplatesPanel } from "./ShiftTemplatesPanel.tsx";

/** Objetos estáveis entre renders (ver nota no teste de LocationsAdminView). */
const auth = vi.hoisted(() => ({
  value: { user: { id: "u1", email: "gestor@exemplo.pt", role: "manager" as "admin" | "manager" | "hr_viewer", organizationId: "org" }, loading: false },
}));
vi.mock("../../../../contexts/AuthContext.tsx", () => ({ useAuth: () => auth.value }));
const locationsState = vi.hoisted(() => ({ locations: [{ id: "loc-mbs", name: "Mercado Bom Sucesso", isActive: true }] }));
vi.mock("../../../locations/adapters/in/use-locations.ts", () => ({ useLocations: () => locationsState }));

function setRole(role: "manager" | "hr_viewer") {
  auth.value = { ...auth.value, user: { ...auth.value.user, role } };
}

function toTemplate(id: string, p: ShiftTemplatePayload): ShiftTemplate {
  const work = 480; // a lista só mostra o valor vindo do backend
  return { id, ...p, kind: p.secondStartTime ? "split" : "direct", workMinutes: work, spanMinutes: work, active: true, updatedAt: "" };
}

/** API falsa só com o que o painel usa; reproduz o 409 de nome duplicado. */
function renderPanel(seed: ShiftTemplate[] = []) {
  let templates = [...seed];
  const api = {
    listShiftTemplates: async () => templates,
    createShiftTemplate: async (p: ShiftTemplatePayload) => {
      if (templates.some((t) => t.name.toLowerCase() === p.name.toLowerCase())) throw new ApiError(`Já existe um modelo de turno com o nome "${p.name}"`, 409);
      const created = toTemplate(`t${templates.length + 1}`, p);
      templates = [...templates, created];
      return created;
    },
    updateShiftTemplate: async () => templates[0]!,
    setShiftTemplateActive: async (id: string, active: boolean) => {
      templates = templates.map((t) => (t.id === id ? { ...t, active } : t));
      return templates.find((t) => t.id === id)!;
    },
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
}

const MANHA = toTemplate("t1", {
  name: "Manhã 1",
  description: "Horário padrão da manhã",
  color: "#3B82F6",
  startTime: "08:00",
  endTime: "16:00",
  endsNextDay: false,
  secondStartTime: null,
  secondEndTime: null,
  breakMinutes: 0,
  locationId: "loc-mbs",
});

describe("ShiftTemplatesPanel", () => {
  it("cria um modelo repartido e mostra-o na lista", async () => {
    setRole("manager");
    renderPanel([MANHA]);
    const user = userEvent.setup();

    expect(await screen.findByText("Mercado Bom Sucesso")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Novo modelo" }));
    const dialog = screen.getByRole("dialog", { name: "Novo modelo de turno" });
    await user.type(within(dialog).getByLabelText(/Nome do modelo/), "Repartido");
    await user.click(within(dialog).getByLabelText(/Repartido/));
    await user.clear(within(dialog).getByLabelText(/Hora de início/));
    await user.type(within(dialog).getByLabelText(/Hora de início/), "12:00");
    await user.clear(within(dialog).getByLabelText(/Hora de fim/));
    await user.type(within(dialog).getByLabelText(/Hora de fim/), "16:00");
    await user.click(within(dialog).getByRole("button", { name: "Guardar modelo" }));

    expect(await screen.findByText("12:00 – 16:00 · 18:00 – 23:00")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("nome duplicado mostra o erro do backend e mantém o modal aberto", async () => {
    setRole("manager");
    renderPanel([MANHA]);
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Duplicar" }));
    const dialog = screen.getByRole("dialog", { name: "Duplicar modelo de turno" });
    const name = within(dialog).getByLabelText(/Nome do modelo/);
    expect(name).toHaveValue("Manhã 1 (cópia)");
    await user.clear(name);
    await user.type(name, "manhã 1");
    await user.click(within(dialog).getByRole("button", { name: "Guardar modelo" }));

    expect(await within(dialog).findByText("Já existe um modelo com este nome.")).toBeInTheDocument();
  });

  it("perfil só-leitura não vê ações", async () => {
    setRole("hr_viewer");
    renderPanel([MANHA]);
    expect(await screen.findByText("Manhã 1")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Novo modelo" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Inativar" })).not.toBeInTheDocument();
  });
});
