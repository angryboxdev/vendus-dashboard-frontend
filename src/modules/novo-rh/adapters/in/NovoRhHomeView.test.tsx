import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../../../../i18n/I18nProvider.tsx";
import { setRequestHeaderProvider } from "../../../../lib/api.ts";
import type { DataMode } from "../../domain/entities/roadmap.ts";
import { fakeNovoRhModule } from "../../fake-module.test-utils.ts";
import { NovoRhProvider, type NovoRhModule } from "../../novo-rh.module.tsx";
import { novoRhModeHeaders } from "../out/http-demo-api.adapter.ts";
import { DataModeCard, DemoModeBanner } from "./DemoMode.tsx";
import { NovoRhHomeView } from "./NovoRhHomeView.tsx";
import { NovoRhLayout } from "./NovoRhLayout.tsx";

function memoryStore(initial: DataMode = "real") {
  const st = { mode: initial, load: () => st.mode, save: (m: DataMode) => void (st.mode = m) };
  return st;
}

const inLayout = (ui: ReactNode, mod: NovoRhModule = fakeNovoRhModule(), store = memoryStore()) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <NovoRhProvider module={mod} modeStore={store}>
      <MemoryRouter initialEntries={["/hr/novo"]}>
        <NovoRhLayout>
          <DemoModeBanner />
          {ui}
        </NovoRhLayout>
      </MemoryRouter>
    </NovoRhProvider>
  </QueryClientProvider>
);

afterEach(() => setRequestHeaderProvider(null));

describe("Novo RH — entrada", () => {
  it("Visão geral = só o Dashboard: sem cabeçalho 'Novo RH', sem 'Em desenvolvimento', sem elementos de migração", () => {
    render(inLayout(<NovoRhHomeView />));
    expect(screen.queryByRole("heading", { level: 1, name: "Novo RH" })).toBeNull();
    expect(screen.queryByText("Em desenvolvimento")).toBeNull();
    expect(screen.getByRole("heading", { level: 1, name: "Dashboard" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Ver o painel anterior (durante a validação)" })).toBeNull();
    expect(screen.getByRole("link", { name: "Configurações" })).toHaveAttribute("href", "/hr/novo/configuracoes");
    expect(screen.getByRole("combobox", { name: "Pesquisar no Mezza ERP..." })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 2, name: "Modo de dados" })).toBeNull();
  });

  it("sem organização fictícia: Demonstração indisponível e oferece criar (com confirmação)", async () => {
    const mod = fakeNovoRhModule();
    render(inLayout(<DataModeCard />, mod));
    expect(screen.getByRole("radio", { name: "Real" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "Demonstração" })).toHaveAttribute("aria-disabled", "true");
    await userEvent.click(await screen.findByRole("button", { name: "Criar organização de demonstração" }));
    expect(mod.demo.create).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Criar" }));
    expect(mod.demo.create).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("Organização fictícia: Demo")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Demonstração" })).not.toBeDisabled();
  });

  it("trocar para Demonstração: guarda o modo, mostra a faixa e volta ao Real", async () => {
    const mod = fakeNovoRhModule({ demo: { status: vi.fn(async () => ({ exists: true, name: "Mezza — Demonstração" })), create: vi.fn(), refresh: vi.fn(async () => ({ punches: 12, scenario: false })) } });
    const store = memoryStore();
    render(inLayout(<DataModeCard />, mod, store));
    const demo = await screen.findByRole("radio", { name: "Demonstração" });
    await vi.waitFor(() => expect(demo).not.toBeDisabled());
    await userEvent.click(demo);
    expect(store.mode).toBe("demo");
    expect(await screen.findByText("Modo Demonstração — dados fictícios")).toBeInTheDocument();
    await userEvent.click(await screen.findByRole("button", { name: "Atualizar dados fictícios" }));
    expect(mod.demo.refresh).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("12 marcações novas.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Voltar ao modo Real" }));
    expect(store.mode).toBe("real");
    expect(screen.queryByText("Modo Demonstração — dados fictícios")).not.toBeInTheDocument();
  });

  it("cabeçalho X-Novo-RH-Mode só em Demonstração e só nos pedidos do Novo RH", () => {
    expect(novoRhModeHeaders("demo")("/api/novo-rh/people")).toEqual({ "X-Novo-RH-Mode": "demo" });
    expect(novoRhModeHeaders("demo")("https://api.example.invalid/api/novo-rh/attendance/days")).toEqual({ "X-Novo-RH-Mode": "demo" });
    expect(novoRhModeHeaders("demo")("/api/locations")).toEqual({});
    expect(novoRhModeHeaders("demo")("/api/me/clock")).toEqual({});
    expect(novoRhModeHeaders("real")("/api/novo-rh/people")).toEqual({});
  });

  it("em es-ES usa o que já está traduzido e pt-PT no resto", () => {
    render(
      <I18nProvider locale="es-ES">{inLayout(<DataModeCard />)}</I18nProvider>,
    );
    expect(screen.getByText("Modo de dados")).toBeInTheDocument();
  });
});
