import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../../../../../lib/api.ts";
import type { SettingDefinition } from "../../../domain/entities/settings.ts";
import type { SettingsApiPort } from "../../../domain/ports/out/settings-api.port.ts";
import { formatSettingValue, parseSettingInput } from "../../../domain/services/settings-format.service.ts";
import { NovoRhProvider } from "../../../novo-rh.module.tsx";
import { fakeNovoRhModule } from "../../../fake-module.test-utils.ts";
import { SettingsView } from "./SettingsView.tsx";

const DEFS: SettingDefinition[] = [
  {
    key: "security.session.inactivity_minutes",
    domain: "security",
    type: "duration",
    unit: "minutes",
    label: "Fim de sessão por inatividade",
    description: "Minutos sem atividade.",
    defaultValue: 30,
    min: 5,
    max: 480,
    sensitive: false,
    legal: false,
    toValidate: true,
  },
];
const PROFILE = { id: "p1", domain: "security" as const, name: "Global segurança", kind: "global" as const, archived: false };

function setup(over: Partial<SettingsApiPort> = {}) {
  const api: SettingsApiPort = {
    listDefinitions: vi.fn(async () => DEFS),
    listProfiles: vi.fn(async () => [PROFILE]),
    features: vi.fn(async () => ({})),
    getProfile: vi.fn(async () => ({
      detail: {
        profile: PROFILE,
        targets: [],
        values: [{ id: "v1", profileId: "p1", key: DEFS[0]!.key, value: 30, validFrom: "2026-10-11", createdAt: "x", createdBy: "a", reason: "r" }],
        version: "1",
      },
      etag: '"e1"',
    })),
    createProfile: vi.fn(),
    addTarget: vi.fn(),
    setValue: vi.fn(async () => ({ value: {} as never, impact: null })),
    impactPreview: vi.fn(async () => ({ employees: 12, pastDays: 5, validFrom: "2026-10-01" })),
    effective: vi.fn(async () => []),
    history: vi.fn(async () => []),
    downloadHistoryCsv: vi.fn(),
    listEmployees: vi.fn(async () => [{ id: "e1", label: "Pessoa Demo" }]),
    listLocations: vi.fn(async () => []),
    ...over,
  };
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <NovoRhProvider module={fakeNovoRhModule({ settings: api })}>
        <SettingsView />
      </NovoRhProvider>
    </QueryClientProvider>,
  );
  return api;
}

describe("Novo RH → Configurações", () => {
  it("mostra o perfil, o valor atual e a marca 'A validar'", async () => {
    setup();
    expect(await screen.findByRole("heading", { name: "Global segurança" })).toBeInTheDocument();
    expect(screen.getByText("30 min")).toBeInTheDocument();
    expect(screen.getByText("A validar")).toBeInTheDocument();
  });

  it("alterar: envia valor, data e motivo com a versão lida (If-Match)", async () => {
    const api = setup();
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Alterar Fim de sessão por inatividade" }));
    const dialog = screen.getByRole("dialog");
    const value = within(dialog).getByLabelText(/Valor/);
    await user.clear(value);
    await user.type(value, "45");
    await user.type(within(dialog).getByLabelText("Motivo"), "Política nova");
    await user.click(within(dialog).getByRole("button", { name: "Guardar" }));
    expect(api.setValue).toHaveBeenCalledWith("p1", '"e1"', expect.objectContaining({ key: DEFS[0]!.key, value: 45, reason: "Política nova" }));
  });

  it("data no passado mostra o impacto; erro do servidor aparece no painel", async () => {
    const setValue = vi.fn(async () => {
      throw new ApiError("É preciso a permissão de alterações retroativas.", 403, { type: "/problems/retroactive_not_allowed" });
    });
    const api = setup({ setValue });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Alterar Fim de sessão por inatividade" }));
    const dialog = screen.getByRole("dialog");
    const date = within(dialog).getByLabelText("Data de efeito");
    await user.clear(date);
    await user.type(date, "2026-10-01");
    expect(await within(dialog).findByText(/afeta 12 colaborador\(es\) em 5 dia\(s\)/)).toBeInTheDocument();
    expect(api.impactPreview).toHaveBeenCalledWith("p1", "2026-10-01");
    await user.type(within(dialog).getByLabelText("Motivo"), "Corrigir");
    await user.click(within(dialog).getByRole("button", { name: "Guardar" }));
    expect(await within(dialog).findByText("É preciso a permissão de alterações retroativas.")).toBeInTheDocument();
  });
});

describe("formatação de valores", () => {
  it("formata e converte por tipo", () => {
    const words = { yes: "Sim", no: "Não" };
    expect(formatSettingValue({ type: "duration", unit: "minutes" }, 15, words)).toBe("15 min");
    expect(formatSettingValue({ type: "bool" }, false, words)).toBe("Não");
    expect(formatSettingValue(undefined, null, words)).toBe("—");
    expect(parseSettingInput({ type: "duration" }, "12")).toBe(12);
    expect(parseSettingInput({ type: "duration" }, "1.5")).toBeNull();
    expect(parseSettingInput({ type: "bool" }, "true")).toBe(true);
    expect(parseSettingInput({ type: "list" }, "a, b")).toEqual(["a", "b"]);
  });
});
