import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../../../../i18n/I18nProvider.tsx";
import { areaFor, areaTabs, legacyTarget, MAIN_NAV, screenFor } from "../../domain/services/screens.registry.ts";
import { fakeNovoRhModule } from "../../fake-module.test-utils.ts";
import { NovoRhProvider, type NovoRhModule } from "../../novo-rh.module.tsx";
import { LegacyRedirect } from "./common/LegacyRedirect.tsx";
import { NovoRhLayout } from "./NovoRhLayout.tsx";

function Where() {
  const l = useLocation();
  return <p data-testid="where">{`${l.pathname}${l.search}${l.hash}`}</p>;
}

function renderAt(path: string, m: NovoRhModule = fakeNovoRhModule()) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <I18nProvider locale="pt-PT">
      <QueryClientProvider client={qc}>
        <NovoRhProvider module={m}>
          <MemoryRouter initialEntries={[path]}>
            <NovoRhLayout>
              <Routes>
                <Route path="/hr/novo/tempo/*" element={<LegacyRedirect />} />
                <Route path="/hr/novo/transferencias/*" element={<LegacyRedirect />} />
                <Route path="*" element={<Where />} />
              </Routes>
            </NovoRhLayout>
          </MemoryRouter>
        </NovoRhProvider>
      </QueryClientProvider>
    </I18nProvider>,
  );
}

describe("Navegação RH (MVP)", () => {
  it("6 áreas principais; cada ecrã pertence a uma área; separadores só onde há mais de um ecrã", () => {
    expect(MAIN_NAV.map((m) => m.path)).toEqual(["/hr/novo", "/hr/novo/pessoas", "/hr/novo/escalas", "/hr/novo/assiduidade", "/hr/novo/ausencias", "/hr/novo/documentos"]);
    expect(areaFor("/hr/novo/assiduidade/fecho")).toBe("attendance");
    expect(areaFor("/hr/novo/pessoas/e1")).toBe("people");
    expect(areaFor("/hr/novo/auditoria")).toBe("settings");
    expect(screenFor("/hr/novo/pessoas")?.label).toBe("novoRh.tab.peopleList");
    expect(areaTabs("attendance").map((s) => s.path)).toEqual([
      "/hr/novo/assiduidade",
      "/hr/novo/assiduidade/registos",
      "/hr/novo/assiduidade/banco-de-horas",
      "/hr/novo/assiduidade/fecho",
      "/hr/novo/assiduidade/relatorios",
    ]);
    expect(areaTabs("rosters")).toEqual([]);
  });

  it("caminhos antigos → novos, com o resto do caminho, query e hash", () => {
    expect(legacyTarget("/hr/novo/tempo", "?d=2026-10-14", "#x")).toBe("/hr/novo/assiduidade/registos?d=2026-10-14#x");
    expect(legacyTarget("/hr/novo/banco-de-horas")).toBe("/hr/novo/assiduidade/banco-de-horas");
    expect(legacyTarget("/hr/novo/fecho/2026-09")).toBe("/hr/novo/assiduidade/fecho/2026-09");
    expect(legacyTarget("/hr/novo/transferencias")).toBe("/hr/novo/pessoas/transferencias");
    expect(legacyTarget("/hr/novo/escalas")).toBeNull();
  });

  it("sem abas horizontais das áreas (a barra lateral é a navegação); topo com sino e Configurações; separadores da área atual", async () => {
    renderAt("/hr/novo/assiduidade/fecho");
    expect(screen.queryByRole("navigation", { name: "Novo RH" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Colaboradores" })).toBeNull();
    expect(screen.getByRole("link", { name: "Configurações" })).toHaveAttribute("href", "/hr/novo/configuracoes");
    expect(screen.getByRole("button", { name: "Pedidos" })).toBeInTheDocument();
    const sub = screen.getByRole("navigation", { name: "Assiduidade" });
    expect(within(sub).getAllByRole("link").map((a) => a.textContent)).toEqual(["Conferência", "Registos de ponto", "Banco de horas", "Fecho", "Relatórios"]);
    expect(screen.queryByRole("link", { name: "Comunicados" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Tarefas" })).toBeNull();
  });

  it("bookmark antigo abre o ecrã novo (sem perder a query)", async () => {
    renderAt("/hr/novo/tempo?employeeId=e1");
    expect(await screen.findByTestId("where")).toHaveTextContent("/hr/novo/assiduidade/registos?employeeId=e1");
  });

  it("Pedidos: contador só com pendentes; gaveta com os pedidos e ligação à caixa completa", async () => {
    const m = fakeNovoRhModule();
    m.inbox.list = vi.fn(async () => ({
      types: [],
      counters: {},
      items: [{ key: "k1", employeeId: "e1", employeeName: "Pessoa Teste", title: "Férias 20–24 out", canDecide: true, locationName: null } as never],
    }));
    renderAt("/hr/novo", m);
    const btn = await screen.findByRole("button", { name: "Pedidos — 1" }); // pedidos + notificações por ler
    await userEvent.click(btn);
    expect(await screen.findByText("Pessoa Teste")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Abrir caixa de pedidos" })).toHaveAttribute("href", "/hr/novo/pedidos");
  });
});
