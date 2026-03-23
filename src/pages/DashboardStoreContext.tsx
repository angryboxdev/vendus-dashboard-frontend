import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { apiGet } from "../lib/api";
import type { MonthlySummary } from "../types/monthlySummary";

function getYesterdayISO(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

const DEFAULT_DATE = getYesterdayISO();

type DashboardStoreValue = {
  since: string;
  until: string;
  type: string;
  setSince: (value: string) => void;
  setUntil: (value: string) => void;
  setType: (value: string) => void;
  data: MonthlySummary | null;
  loading: boolean;
  error: string | null;
  load: () => Promise<void>;
  url: string;
};

const DashboardStoreContext = createContext<DashboardStoreValue | null>(null);

export function DashboardStoreProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [since, setSinceState] = useState(DEFAULT_DATE);
  const [until, setUntilState] = useState(DEFAULT_DATE);
  const [type, setTypeState] = useState("FS");
  const [data, setData] = useState<MonthlySummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const url = useMemo(
    () =>
      `/api/reports/monthly-summary?${new URLSearchParams({ since, until }).toString()}`,
    [since, until]
  );

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const json = await apiGet<MonthlySummary>(url);
      setData(json);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao carregar");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load só no mount; depois usa botão Atualizar
  }, []);

  const setSince = useCallback((value: string) => setSinceState(value), []);
  const setUntil = useCallback((value: string) => setUntilState(value), []);
  const setType = useCallback((value: string) => setTypeState(value), []);

  const value: DashboardStoreValue = {
    since,
    until,
    type,
    setSince,
    setUntil,
    setType,
    data,
    loading,
    error,
    load,
    url,
  };

  return (
    <DashboardStoreContext.Provider value={value}>
      {children}
    </DashboardStoreContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useDashboardStore(): DashboardStoreValue {
  const ctx = useContext(DashboardStoreContext);
  if (!ctx) {
    throw new Error("useDashboardStore must be used within DashboardStoreProvider");
  }
  return ctx;
}
