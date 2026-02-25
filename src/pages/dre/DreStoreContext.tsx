import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type { CustosFixoItem } from "./custosFixos.types";
import type { ReceitaBrutaPayload } from "./receitaBruta.types";
import type { CustosVariaveisPayload } from "./custosVariaveis.types";
import type { DREKpisPayload } from "./dreKpis.types";
import { apiGet } from "../../lib/api";
import { useDrePeriod } from "./DrePeriodContext";

type DreCache = {
  custosVariaveis: CustosVariaveisPayload | null;
  custosFixos: CustosFixoItem[] | null;
  receitaBruta: ReceitaBrutaPayload | null;
  kpis: DREKpisPayload | null;
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
  custosFixos: CustosFixoItem[] | null;
  loadingCustosFixos: boolean;
  loadCustosFixos: (force?: boolean) => Promise<void>;
  setCustosFixos: (data: CustosFixoItem[]) => void;
  receitaBruta: ReceitaBrutaPayload | null;
  loadingReceitaBruta: boolean;
  loadReceitaBruta: (force?: boolean) => Promise<void>;
  setReceitaBruta: (data: ReceitaBrutaPayload) => void;
  kpis: DREKpisPayload | null;
  loadingKpis: boolean;
  loadKpis: (force?: boolean) => Promise<void>;
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
  const [loadingCustosFixos, setLoadingCustosFixos] = useState(false);
  const [loadingReceitaBruta, setLoadingReceitaBruta] = useState(false);
  const [loadingKpis, setLoadingKpis] = useState(false);

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

  const loadCustosFixos = useCallback(
    async (force?: boolean) => {
      if (
        !force &&
        cache.custosFixos !== null &&
        cacheKeyRef.current === currentKey
      ) {
        return;
      }
      const keyAtStart = currentKey;
      setLoadingCustosFixos(true);
      try {
        const res = await apiGet<CustosFixoItem[]>(
          `/api/reports/dre/custos-fixos?year=${period.year}&month=${period.month}`
        );
        if (cacheKeyRef.current !== keyAtStart) return;
        setCache((prev) => ({
          ...prev,
          custosFixos: Array.isArray(res) ? res : [],
        }));
      } catch {
        if (cacheKeyRef.current !== keyAtStart) return;
        setCache((prev) => ({ ...prev, custosFixos: [] }));
      } finally {
        setLoadingCustosFixos(false);
      }
    },
    [period.year, period.month, currentKey, cache.custosFixos]
  );

  const setCustosFixos = useCallback((data: CustosFixoItem[]) => {
    setCache((prev) => ({ ...prev, custosFixos: data }));
  }, []);

  const loadReceitaBruta = useCallback(
    async (force?: boolean) => {
      if (
        !force &&
        cache.receitaBruta !== null &&
        cacheKeyRef.current === currentKey
      ) {
        return;
      }
      const keyAtStart = currentKey;
      setLoadingReceitaBruta(true);
      try {
        const res = await apiGet<ReceitaBrutaPayload>(
          `/api/reports/dre/receita-bruta?year=${period.year}&month=${period.month}`
        );
        if (cacheKeyRef.current !== keyAtStart) return;
        setCache((prev) => ({
          ...prev,
          receitaBruta: {
            dinheiro: res.dinheiro ?? [],
            tpa: res.tpa ?? [],
            apps: res.apps ?? [],
            tax_amount: res.tax_amount ?? 0,
          },
        }));
      } catch {
        if (cacheKeyRef.current !== keyAtStart) return;
        setCache((prev) => ({
          ...prev,
          receitaBruta: {
            dinheiro: [],
            tpa: [],
            apps: [],
            tax_amount: 0,
          },
        }));
      } finally {
        setLoadingReceitaBruta(false);
      }
    },
    [period.year, period.month, currentKey, cache.receitaBruta]
  );

  const setReceitaBruta = useCallback((data: ReceitaBrutaPayload) => {
    setCache((prev) => ({ ...prev, receitaBruta: data }));
  }, []);

  const loadKpis = useCallback(
    async (force?: boolean) => {
      if (
        !force &&
        cache.kpis !== null &&
        cacheKeyRef.current === currentKey
      ) {
        return;
      }
      const keyAtStart = currentKey;
      setLoadingKpis(true);
      try {
        const res = await apiGet<DREKpisPayload>(
          `/api/reports/dre/kpis?year=${period.year}&month=${period.month}`
        );
        if (cacheKeyRef.current !== keyAtStart) return;
        setCache((prev) => ({ ...prev, kpis: res }));
      } catch {
        if (cacheKeyRef.current !== keyAtStart) return;
        setCache((prev) => ({ ...prev, kpis: null }));
      } finally {
        setLoadingKpis(false);
      }
    },
    [period.year, period.month, currentKey, cache.kpis]
  );

  const value = useMemo<DreStoreValue>(
    () => ({
      custosVariaveis: cache.custosVariaveis,
      loadingCustosVariaveis,
      loadCustosVariaveis,
      setCustosVariaveis,
      custosFixos: cache.custosFixos,
      loadingCustosFixos,
      loadCustosFixos,
      setCustosFixos,
      receitaBruta: cache.receitaBruta,
      loadingReceitaBruta,
      loadReceitaBruta,
      setReceitaBruta,
      kpis: cache.kpis,
      loadingKpis,
      loadKpis,
    }),
    [
      cache.custosVariaveis,
      cache.custosFixos,
      cache.receitaBruta,
      cache.kpis,
      loadingCustosVariaveis,
      loadCustosVariaveis,
      setCustosVariaveis,
      loadingCustosFixos,
      loadCustosFixos,
      setCustosFixos,
      loadingReceitaBruta,
      loadReceitaBruta,
      setReceitaBruta,
      loadingKpis,
      loadKpis,
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
