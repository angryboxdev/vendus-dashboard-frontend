import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { StockDemoScenario } from "./domain/entities/stock-demo.ts";
import type { StockDemoApiPort, StockDemoModeStorePort } from "./domain/ports/out/stock-demo.port.ts";
import { isStockPage, stockDemoHeaders } from "./domain/services/demo-mode.ts";

// O fornecedor de cabeçalhos registado pelo módulo fica guardado aqui (em vez do cliente HTTP real).
const providers: ((path: string) => Record<string, string>)[] = [];
vi.mock("../../lib/api.ts", () => ({
  addRequestHeaderProvider: (p: (path: string) => Record<string, string>) => {
    providers.push(p);
    return () => providers.splice(providers.indexOf(p), 1);
  },
  apiGet: vi.fn(),
  apiPost: vi.fn(),
}));

const { StockDemoProvider } = await import("./stock-demo.module.tsx");
const { StockDemoBanner, StockDemoMenu } = await import("./adapters/in/StockDemoControls.tsx");

const headers = (path: string) => Object.assign({}, ...providers.map((p) => p(path))) as Record<string, string>;

function memoryStore(initial: StockDemoScenario | null): StockDemoModeStorePort {
  let v = initial;
  return { get: () => v, set: (s) => { v = s; } };
}
const status = {
  scenarios: [
    { scenario: "brasileira" as const, label: "Comida brasileira", created: false, posName: null, posApiKeyHint: null, monthlySalesTargetCents: null },
    { scenario: "hamburgueria" as const, label: "Hamburgueria", created: true, posName: "CaixaFlow POS", posApiKeyHint: "demo-pos-••••7Q2K", monthlySalesTargetCents: 6_300_000 },
    { scenario: "bar" as const, label: "Bar", created: false, posName: null, posApiKeyHint: null, monthlySalesTargetCents: null },
  ],
};
const fakeApi = (): StockDemoApiPort => ({
  getStatus: vi.fn(async () => status),
  create: vi.fn(async (s) => ({ scenario: s, created: true, summary: null, forecast: "ok" as const })),
  reset: vi.fn(async (s) => ({ scenario: s, created: false, summary: null, forecast: "ok" as const })),
});

afterEach(() => {
  window.history.pushState({}, "", "/");
});

describe("regra do cabeçalho X-Stock-Demo", () => {
  it("só em páginas do Stock, só para a API e só com cenário", () => {
    expect(isStockPage("/stock/stock")).toBe(true);
    expect(isStockPage("/stockpile")).toBe(false);
    expect(stockDemoHeaders("/api/stock/items", "/stock/stock", "bar")).toEqual({ "X-Stock-Demo": "bar" });
    expect(stockDemoHeaders("/api/stock/items", "/financial/invoices", "bar")).toEqual({});
    expect(stockDemoHeaders("/api/stock/items", "/stock/stock", null)).toEqual({});
  });
});

describe("demonstração do Stock na interface", () => {
  it("o primeiro pedido de um ecrã já leva o cabeçalho do cenário", () => {
    window.history.pushState({}, "", "/stock/stock");
    const seen: Record<string, string>[] = [];
    function Screen() {
      useEffect(() => {
        seen.push(headers("/api/stock/items"));
      }, []);
      return null;
    }
    render(
      <StockDemoProvider isAdmin module={{ api: fakeApi(), store: memoryStore("hamburgueria") }}>
        <Screen />
      </StockDemoProvider>,
    );
    expect(seen[0]).toEqual({ "X-Stock-Demo": "hamburgueria" });
  });

  it("não-Admin: sem botão e sem cabeçalho, mesmo com um cenário guardado", () => {
    window.history.pushState({}, "", "/stock/stock");
    render(
      <StockDemoProvider isAdmin={false} module={{ api: fakeApi(), store: memoryStore("bar") }}>
        <StockDemoMenu />
      </StockDemoProvider>,
    );
    expect(screen.queryByRole("button", { name: /Demonstração/ })).toBeNull();
    expect(headers("/api/stock/items")).toEqual({});
  });

  it("escolher um cenário por criar: cria, ativa e mostra a faixa; sair volta aos dados reais", async () => {
    window.history.pushState({}, "", "/stock/stock");
    const api = fakeApi();
    render(
      <StockDemoProvider isAdmin module={{ api, store: memoryStore(null) }}>
        <StockDemoBanner />
        <StockDemoMenu />
      </StockDemoProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Demonstração" }));
    fireEvent.click(await screen.findByRole("menuitemradio", { name: /Bar/ }));
    await waitFor(() => expect(api.create).toHaveBeenCalledWith("bar"));
    expect(await screen.findByText(/Demonstração: Bar/, { selector: "b" })).toBeTruthy();
    expect(headers("/api/pizzas")).toEqual({ "X-Stock-Demo": "bar" });
    fireEvent.click(screen.getByRole("button", { name: "Sair da demonstração" }));
    expect(screen.queryByText(/Demonstração: Bar/, { selector: "b" })).toBeNull();
    expect(headers("/api/pizzas")).toEqual({});
  });

  it("cenário já criado abre sem criar; recomeçar chama o reset", async () => {
    window.history.pushState({}, "", "/stock/stock");
    const api = fakeApi();
    render(
      <StockDemoProvider isAdmin module={{ api, store: memoryStore(null) }}>
        <StockDemoBanner />
        <StockDemoMenu />
      </StockDemoProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Demonstração" }));
    fireEvent.click(await screen.findByRole("menuitemradio", { name: /Hamburgueria/ }));
    expect(await screen.findByText(/chave demo-pos-••••7Q2K/)).toBeTruthy();
    expect(api.create).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Recomeçar demonstração" }));
    await waitFor(() => expect(api.reset).toHaveBeenCalledWith("hamburgueria"));
  });
});
