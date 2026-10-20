import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { SettingDefinition, SettingProfile } from "../../../domain/entities/settings.ts";
import type { SettingsApiPort } from "../../../domain/ports/out/settings-api.port.ts";
import { TOPICS, topicDefinitions, uncovered } from "../../../domain/services/settings-topics.service.ts";
import { fakeNovoRhModule } from "../../../fake-module.test-utils.ts";
import { NovoRhProvider } from "../../../novo-rh.module.tsx";
import { SettingsHubView } from "./SettingsHubView.tsx";

const def = (key: string, domain: SettingDefinition["domain"], label: string): SettingDefinition => ({ key, domain, type: "int", label, description: "", defaultValue: 0, sensitive: false, legal: false, toValidate: false });
const bool = (key: string, label: string, defaultValue: boolean): SettingDefinition => ({ ...def(key, "time_tracking", label), type: "bool", defaultValue });
const DEFS = [
  bool("time_tracking.bank.enabled", "Banco de horas", true),
  bool("time_tracking.kiosk.enabled", "Quiosque de ponto", true),
  bool("time_tracking.auto_close.enabled", "Saída automática", false),
  def("time_tracking.tolerance.minutes", "time_tracking", "Tolerância de atraso"),
  def("time_tracking.rounding.minutes", "time_tracking", "Arredondamento"),
  def("time_tracking.bank.period", "time_tracking", "Corte do banco de horas"),
  def("time_tracking.roster.rest_severity", "time_tracking", "Descanso entre turnos"),
  def("security.session.inactivity_minutes", "security", "Fim de sessão"),
];
const GLOBAL: SettingProfile = { id: "g1", domain: "time_tracking", name: "Geral", kind: "global", archived: false };

function setup(profiles: SettingProfile[], over: Partial<SettingsApiPort> = {}, run = vi.fn(async () => ({ people: 3, notices: 2 }))) {
  const api = {
    listDefinitions: vi.fn(async () => DEFS),
    listProfiles: vi.fn(async () => profiles),
    getProfile: vi.fn(async (id: string) => ({ detail: { profile: profiles.find((p) => p.id === id)!, targets: [], values: [], version: "1" }, etag: '"1"' })),
    createProfile: vi.fn(async () => GLOBAL),
    effective: vi.fn(async () => []),
    history: vi.fn(async () => []),
    listEmployees: vi.fn(async () => []),
    listLocations: vi.fn(async () => []),
    ...over,
  } as unknown as SettingsApiPort;
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <NovoRhProvider module={fakeNovoRhModule({ settings: api, reminders: { run } })} modeStore={{ load: () => "real", save: () => {} }}>
        <MemoryRouter initialEntries={["/hr/novo/configuracoes"]}>
          <SettingsHubView />
        </MemoryRouter>
      </NovoRhProvider>
    </QueryClientProvider>,
  );
  return api;
}

describe("Configurações por tema (FE-090)", () => {
  it("cada parâmetro do catálogo real pertence a exatamente um tema (nenhum fica esquecido)", () => {
    // Chaves do catálogo do backend (src/modules/settings/domain/services/setting-catalog.ts).
    const REAL =
      "security.mfa.required time_tracking.roster.coverage_enabled time_tracking.portal.uses_novo_rh time_tracking.bank.enabled time_tracking.kiosk.enabled security.session.inactivity_minutes security.privacy.retention_years_after_termination security.visibility.whos_in_scope security.visibility.coworkers_shifts notifications.channels.email notifications.channels.push notifications.channels.whatsapp legal.rest.min_minutes_between_workdays legal.hours.max_daily_minutes legal.hours.max_weekly_minutes legal.hours.max_annual_hours legal.night.start legal.night.end legal.vacation.min_annual_days time_tracking.theoretical.mode time_tracking.night_shift.rule time_tracking.night_shift.continuity_minutes time_tracking.block_before_start_minutes time_tracking.ip_allowlist time_tracking.geofence.require_coordinates time_tracking.geofence.block_outside time_tracking.correction.employee_can_refuse time_tracking.correction.refusal_hours time_tracking.rounding.minutes time_tracking.incidents.hours_count time_tracking.open_record.max_hours time_tracking.kiosk.methods time_tracking.roster.rest_severity time_tracking.roster.limits_severity time_tracking.roster.absence_severity time_tracking.bank.period time_tracking.bank.excess_validation time_tracking.bank.compensate_beyond_balance time_tracking.bank.paid_annual_limit_hours time_tracking.bank.paid_after_limit time_tracking.bank.expiry_days time_tracking.bank.holiday_mode time_tracking.bank.employee_sees_history time_tracking.tolerance.minutes time_tracking.auto_close.enabled notifications.auto_close_warning.enabled notifications.reminder.missing_in.enabled notifications.reminder.missing_in.minutes notifications.reminder.open_after_end.enabled notifications.reminder.open_after_end.minutes notifications.contract.probation_end.enabled notifications.contract.probation_end.days notifications.contract.end.enabled notifications.contract.end.days".split(" ");
    const realDefs = REAL.map((k) => def(k, k.split(".")[0] as SettingDefinition["domain"], k));
    expect(uncovered(realDefs)).toEqual([]);
    // «Funcionalidades» junta parâmetros de vários domínios; os outros temas são de um domínio.
    for (const d of realDefs) expect(TOPICS.filter((x) => x.match(d.key) && (x.key === "features" || x.domain === d.domain)).map((x) => x.key)).toHaveLength(1);
    expect(topicDefinitions(TOPICS.find((x) => x.key === "features")!, realDefs).map((d) => d.key)).toEqual(expect.arrayContaining(["time_tracking.bank.enabled", "time_tracking.bank.period", "time_tracking.kiosk.methods", "security.mfa.required", "time_tracking.portal.uses_novo_rh"]));
    expect(uncovered(DEFS)).toEqual([]);
    expect(topicDefinitions(TOPICS.find((x) => x.key === "attendance")!, DEFS).map((d) => d.key)).toEqual(["time_tracking.tolerance.minutes", "time_tracking.rounding.minutes"]);
  });

  it("abre em Funcionalidades: interruptores; as definições de uma funcionalidade só aparecem com ela ligada", async () => {
    let values: { key: string; value: unknown }[] = [];
    const api = setup([GLOBAL], {
      getProfile: vi.fn(async () => ({ detail: { profile: GLOBAL, targets: [], values: values.map((v, i) => ({ id: `v${i}`, profileId: "g1", validFrom: "2026-10-01", createdAt: "", createdBy: "", reason: "", ...v })), version: "1" }, etag: '"1"' })),
      setValue: vi.fn(async (_p: string, _e: string | null, input: { key: string; value: unknown }) => {
        values = [...values.filter((v) => v.key !== input.key), { key: input.key, value: input.value }];
        return { value: {}, impact: null };
      }),
    } as never);
    const bank = await screen.findByRole("switch", { name: "Banco de horas" });
    // Ligado por omissão: as definições do banco aparecem por baixo; a saída automática está desligada.
    expect(bank).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText("Corte do banco de horas")).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Saída automática" })).toHaveAttribute("aria-checked", "false");
    // As regras base não aparecem aqui.
    expect(screen.queryByText("Tolerância de atraso")).not.toBeInTheDocument();
    await userEvent.click(bank);
    expect(api.setValue).toHaveBeenCalledWith("g1", '"1"', expect.objectContaining({ key: "time_tracking.bank.enabled", value: false, reason: "Desligado em Funcionalidades" }));
    expect(await screen.findByRole("switch", { name: "Banco de horas" })).toHaveAttribute("aria-checked", "false");
    expect(screen.queryByText("Corte do banco de horas")).not.toBeInTheDocument();
  });

  it("tema Assiduidade mostra só as regras base (sem as das funcionalidades)", async () => {
    setup([GLOBAL, { id: "x1", domain: "time_tracking", name: "Porto", kind: "segment", archived: false }]);
    await userEvent.click(within(await screen.findByRole("navigation", { name: "Configurações" })).getByRole("button", { name: "Assiduidade" }));
    expect(await screen.findByText("Tolerância de atraso")).toBeInTheDocument();
    expect(screen.queryByText("Corte do banco de horas")).not.toBeInTheDocument();
    expect(screen.queryByText("Saída automática")).not.toBeInTheDocument();
    expect(screen.getByText("1 perfil(is) com exceções por centro, grupo ou pessoa.")).toBeInTheDocument();
  });

  it("sem perfil geral: oferece criá-lo", async () => {
    const api = setup([]);
    await userEvent.click(within(await screen.findByRole("navigation", { name: "Configurações" })).getByRole("button", { name: "Assiduidade" }));
    await userEvent.click(await screen.findByRole("button", { name: "Criar regras gerais" }));
    expect(api.createProfile).toHaveBeenCalledWith({ domain: "time_tracking", name: "Geral", kind: "global" });
  });

  it("catálogos e empresa são atalhos para os ecrãs que já existem", async () => {
    setup([GLOBAL]);
    const nav = await screen.findByRole("navigation", { name: "Configurações" });
    await userEvent.click(within(nav).getByRole("button", { name: "Catálogos" }));
    expect(screen.getByRole("link", { name: /Tipos de ausência/ })).toHaveAttribute("href", "/hr/novo/ausencias");
    await userEvent.click(within(nav).getByRole("button", { name: "Empresa, locais e papéis" }));
    expect(screen.getByRole("link", { name: /Locais/ })).toHaveAttribute("href", "/empresa/locais");
  });

  it("Notificações: verificar já os avisos automáticos", async () => {
    const run = vi.fn(async () => ({ people: 3, notices: 2 }));
    setup([GLOBAL], {}, run);
    await userEvent.click(within(await screen.findByRole("navigation", { name: "Configurações" })).getByRole("button", { name: "Notificações" }));
    await userEvent.click(await screen.findByRole("button", { name: "Verificar agora" }));
    expect(run).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("2 aviso(s) enviado(s).")).toBeInTheDocument();
  });
});
