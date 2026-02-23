import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type { CustosVariaveisPayload } from "./custosVariaveis.types";
import { apiGet } from "../../lib/api";
import { useDrePeriod } from "./DrePeriodContext";

type DreCache = {
  custosVariaveis: CustosVariaveisPayload | null;
  custosFixos: unknown | null;
  receitaBruta: unknown | null;
  kpis: unknown | null;
};

const EMPTY_CACHE: DreCache = {
  custosVariaveis: null,
  custosFixos: null,
  receitaBruta: null,
  kpis: null,
};

type DreStoreValue = {
  custosVariaveis: CustosVariaveisPayload | null;
  loadingCustosVariaveis: boolean;
  loadCustosVariaveis: (force?: boolean) => Promise<void>;
  setCustosVariaveis: (data: CustosVariaveisPayload) => void;
  custosFixos: unknown | null;
  receitaBruta: unknown | null;
  kpis: unknown | null;
};

const DreStoreContext = createContext<DreStoreValue | null>(null);

function periodKey(year: number, month: number) {
  return `${year}-${month}`;
}

export function DreStoreProvider({ children }: { children: React.ReactNode }) {
  const { period } = useDrePeriod();
  const currentKey = periodKey(period.year, period.month);
  const cacheKeyRef = useRef(currentKey);
  const [cache, setCache] = useState<DreCache>(EMPTY_CACHE);
  const [loadingCustosVariaveis, setLoadingCustosVariaveis] = useState(false);

  useEffect(() => {
    if (currentKey !== cacheKeyRef.current) {
      cacheKeyRef.current = currentKey;
      setCache(EMPTY_CACHE);
    }
  }, [currentKey]);

  const loadCustosVariaveis = useCallback(
    async (force?: boolean) => {
      if (
        !force &&
        cache.custosVariaveis !== null &&
        cacheKeyRef.current === currentKey
      ) {
        return;
      }
      const keyAtStart = currentKey;
      setLoadingCustosVariaveis(true);
      try {
        const res = await apiGet<CustosVariaveisPayload>(
          `/api/reports/dre/custos-variaveis?year=${period.year}&month=${period.month}`
        );
        if (cacheKeyRef.current !== keyAtStart) return;
        setCache((prev) => ({
          ...prev,
          custosVariaveis: {
            producao: res.producao ?? [],
            venda: res.venda ?? [],
          },
        }));
      } catch {
        if (cacheKeyRef.current !== keyAtStart) return;
        setCache((prev) => ({
          ...prev,
          custosVariaveis: { producao: [], venda: [] },
        }));
      } finally {
        setLoadingCustosVariaveis(false);
      }
    },
    [period.year, period.month, currentKey, cache.custosVariaveis]
  );

  const setCustosVariaveis = useCallback((data: CustosVariaveisPayload) => {
    setCache((prev) => ({ ...prev, custosVariaveis: data }));
  }, []);

  const value = useMemo<DreStoreValue>(
    () => ({
      custosVariaveis: cache.custosVariaveis,
      loadingCustosVariaveis,
      loadCustosVariaveis,
      setCustosVariaveis,
      custosFixos: cache.custosFixos,
      receitaBruta: cache.receitaBruta,
      kpis: cache.kpis,
    }),
    [
      cache.custosVariaveis,
      cache.custosFixos,
      cache.receitaBruta,
      cache.kpis,
      loadingCustosVariaveis,
      loadCustosVariaveis,
      setCustosVariaveis,
    ]
  );

  return (
    <DreStoreContext.Provider value={value}>
      {children}
    </DreStoreContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useDreStore(): DreStoreValue {
  const ctx = useContext(DreStoreContext);
  if (!ctx) {
    throw new Error("useDreStore must be used within DreStoreProvider");
  }
  return ctx;
}
