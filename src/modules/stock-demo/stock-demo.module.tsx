import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { addRequestHeaderProvider } from "../../lib/api.ts";
import { HttpStockDemoApiAdapter, LocalStorageStockDemoModeStore } from "./adapters/out/stock-demo.adapters.ts";
import type { StockDemoScenario } from "./domain/entities/stock-demo.ts";
import type { StockDemoApiPort, StockDemoModeStorePort } from "./domain/ports/out/stock-demo.port.ts";
import { stockDemoHeaders } from "./domain/services/demo-mode.ts";

export interface StockDemoModule {
  api: StockDemoApiPort;
  store: StockDemoModeStorePort;
}

interface StockDemoContextValue {
  api: StockDemoApiPort;
  /** Cenário ativo (só Admins; para os restantes é sempre `null`). */
  scenario: StockDemoScenario | null;
  isAdmin: boolean;
  setScenario: (scenario: StockDemoScenario | null) => void;
  /** Muda a cada troca ou recomeço: o layout do Stock usa-o como chave para remontar os ecrãs (voltam a ler). */
  version: number;
  refresh: () => void;
}

const StockDemoContext = createContext<StockDemoContextValue | null>(null);


/**
 * Demonstração do Stock (independente da do RH): guarda o cenário escolhido e junta `X-Stock-Demo` aos pedidos
 * feitos a partir das páginas do Stock. Montado no layout do Stock: fora do Stock não há cabeçalho.
 */
export function StockDemoProvider({ children, isAdmin, module: mod }: { children: ReactNode; isAdmin: boolean; module?: StockDemoModule }) {
  const deps = useMemo(() => mod ?? { api: new HttpStockDemoApiAdapter(), store: new LocalStorageStockDemoModeStore() }, [mod]);
  const [stored, setStored] = useState<StockDemoScenario | null>(() => deps.store.get());
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion((v) => v + 1), []);
  const scenario = isAdmin ? stored : null;
  // O cabeçalho lê o cenário de um ref atualizado em useLayoutEffect: todos os layout effects (também os do pai)
  // correm antes dos useEffect dos ecrãs filhos, onde estes fazem os pedidos — o primeiro pedido já sai certo.
  const scenarioRef = useRef<StockDemoScenario | null>(scenario);
  useLayoutEffect(() => {
    scenarioRef.current = scenario;
  }, [scenario]);
  useLayoutEffect(() => addRequestHeaderProvider((path) => stockDemoHeaders(path, window.location.pathname, scenarioRef.current)), []);

  const setScenario = useCallback(
    (next: StockDemoScenario | null) => {
      deps.store.set(next);
      setStored(next);
      setVersion((v) => v + 1);
    },
    [deps],
  );
  const value = useMemo(() => ({ api: deps.api, scenario, isAdmin, setScenario, version, refresh }), [deps, scenario, isAdmin, setScenario, version, refresh]);
  return <StockDemoContext.Provider value={value}>{children}</StockDemoContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useStockDemo(): StockDemoContextValue {
  const ctx = useContext(StockDemoContext);
  if (!ctx) throw new Error("useStockDemo must be used inside StockDemoProvider");
  return ctx;
}
