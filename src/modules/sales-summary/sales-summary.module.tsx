import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { HttpSalesSummaryApiAdapter } from "./adapters/out/http-sales-summary-api.adapter.ts";
import { GetSalesSummaryUseCase } from "./application/use-cases/get-sales-summary.use-case.ts";
import { RefreshSalesSummaryUseCase } from "./application/use-cases/refresh-sales-summary.use-case.ts";
import type { GetSalesSummaryPort } from "./domain/ports/in/get-sales-summary.port.ts";
import type { RefreshSalesSummaryPort } from "./domain/ports/in/refresh-sales-summary.port.ts";
import {
  currentPeriod,
  prevMonth,
  type SalesPeriod,
  type SalesSummaryResult,
} from "./domain/entities/sales-summary.ts";

// ─── Module (use-case instances) ──────────────────────────────────────────────

export interface SalesSummaryModule {
  getSalesSummary: GetSalesSummaryPort;
  refreshSalesSummary: RefreshSalesSummaryPort;
}

function buildModule(): SalesSummaryModule {
  const api = new HttpSalesSummaryApiAdapter();
  return {
    getSalesSummary: new GetSalesSummaryUseCase(api),
    refreshSalesSummary: new RefreshSalesSummaryUseCase(api),
  };
}

// ─── Context value ────────────────────────────────────────────────────────────

export interface SalesSummaryContextValue {
  selectedPeriod: SalesPeriod;
  setPeriod: (p: SalesPeriod) => void;
  comparisonPeriod: SalesPeriod;

  summary: SalesSummaryResult | null;
  comparisonSummary: SalesSummaryResult | null;
  loading: boolean;
  error: string | null;

  refresh: () => Promise<void>;
  refreshing: boolean;
}

const SalesSummaryContext = createContext<SalesSummaryContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function SalesSummaryProvider({
  children,
  module: mod,
}: {
  children: ReactNode;
  module?: SalesSummaryModule;
}) {
  const { getSalesSummary, refreshSalesSummary } = useMemo(
    () => mod ?? buildModule(),
    [mod],
  );

  const [selectedPeriod, setSelectedPeriod] = useState<SalesPeriod>(currentPeriod);
  const comparisonPeriod = useMemo(() => prevMonth(selectedPeriod), [selectedPeriod]);

  const [summary, setSummary] = useState<SalesSummaryResult | null>(null);
  const [comparisonSummary, setComparisonSummary] = useState<SalesSummaryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Stable ref so the refresh callback doesn't depend on selectedPeriod in its closure
  const selectedPeriodRef = useRef(selectedPeriod);
  useEffect(() => { selectedPeriodRef.current = selectedPeriod; }, [selectedPeriod]);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError(null);
    setSummary(null);
    setComparisonSummary(null);

    const { year, month } = selectedPeriod;
    const { year: cy, month: cm } = comparisonPeriod;

    Promise.allSettled([
      getSalesSummary.execute(year, month),
      getSalesSummary.execute(cy, cm),
    ]).then(([mainRes, compRes]) => {
      if (cancelled) return;
      if (mainRes.status === "rejected") {
        const msg = mainRes.reason instanceof Error
          ? mainRes.reason.message
          : "Erro ao carregar dados";
        setError(msg);
      } else {
        setSummary(mainRes.value);
        if (compRes.status === "fulfilled") setComparisonSummary(compRes.value);
      }
      setLoading(false);
    });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPeriod.year, selectedPeriod.month, getSalesSummary]);

  const setPeriod = useCallback((p: SalesPeriod) => {
    setSelectedPeriod(p);
  }, []);

  const refresh = useCallback(async () => {
    const { year, month } = selectedPeriodRef.current;
    setRefreshing(true);
    setError(null);
    try {
      const result = await refreshSalesSummary.execute(year, month);
      setSummary(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao actualizar");
    } finally {
      setRefreshing(false);
    }
  }, [refreshSalesSummary]);

  const value: SalesSummaryContextValue = {
    selectedPeriod,
    setPeriod,
    comparisonPeriod,
    summary,
    comparisonSummary,
    loading,
    error,
    refresh,
    refreshing,
  };

  return (
    <SalesSummaryContext.Provider value={value}>
      {children}
    </SalesSummaryContext.Provider>
  );
}

export function useSalesSummaryContext(): SalesSummaryContextValue {
  const ctx = useContext(SalesSummaryContext);
  if (!ctx) throw new Error("useSalesSummaryContext must be used inside SalesSummaryProvider");
  return ctx;
}
