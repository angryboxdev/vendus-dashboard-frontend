import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DateRange, ForecastResult, SalesAnalysisData, SourceSelection } from "../../domain/entities/sales-analysis.ts";
import { buildAnalysis, type Analysis } from "../../domain/services/analysis.service.ts";
import { presetRange, rangeProblem, type Preset } from "../../domain/services/periods.ts";
import { useSalesAnalysisModule } from "../../sales-analysis.module.tsx";

export interface Filters {
  source: SourceSelection;
  preset: Preset;
  custom: DateRange;
}

const POLL_MS = 5_000;

export function useSalesAnalysis() {
  const mod = useSalesAnalysisModule();
  const today = mod.today();
  const [filters, setFilters] = useState<Filters>({ source: "vendus", preset: "this_month", custom: { from: `${today.slice(0, 7)}-01`, to: today } });
  const range = useMemo(() => presetRange(filters.preset, filters.custom, today), [filters.preset, filters.custom, today]);
  const problem = rangeProblem(range, today);

  const [data, setData] = useState<SalesAnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forecast, setForecast] = useState<ForecastResult | null>(null);
  const [forecastError, setForecastError] = useState<string | null>(null);
  const reqId = useRef(0);

  const load = useCallback(async (silent = false) => {
    if (problem) { setLoading(false); return; }
    const id = ++reqId.current;
    if (!silent) { setLoading(true); setError(null); }
    try {
      const d = await mod.getAnalysis.execute(range, filters.source);
      if (id === reqId.current) { setData(d); setError(null); }
    } catch (e) {
      if (id === reqId.current && !silent) setError(e instanceof Error ? e.message : "Não foi possível carregar a análise de vendas.");
    } finally {
      if (id === reqId.current && !silent) setLoading(false);
    }
  }, [mod, range, filters.source, problem]);

  useEffect(() => { void load(); }, [load]);

  // Enquanto a Vendus enche a cache ou um mês da AirMenu está a ser buscado, atualiza sozinho.
  const busy = !!data && (data.vendus?.fill?.running === true || (data.airMenu?.months ?? []).some((m) => m.state === "fetching"));
  useEffect(() => {
    if (!busy) return;
    const t = setInterval(() => void load(true), POLL_MS);
    return () => clearInterval(t);
  }, [busy, load]);

  // Previsão: só no mês corrente.
  const isCurrentMonth = range.from === `${today.slice(0, 7)}-01` && range.to === today;
  const loadForecast = useCallback(async () => {
    try {
      setForecast(await mod.getForecast.execute(filters.source));
      setForecastError(null);
    } catch {
      setForecastError("Previsão indisponível de momento.");
    }
  }, [mod, filters.source]);
  useEffect(() => {
    setForecast(null);
    setForecastError(null);
    if (isCurrentMonth) void loadForecast();
  }, [isCurrentMonth, loadForecast]);
  useEffect(() => {
    if (!isCurrentMonth || forecast?.status !== "pending") return;
    const t = setInterval(() => void loadForecast(), POLL_MS * 2);
    return () => clearInterval(t);
  }, [isCurrentMonth, forecast?.status, loadForecast]);

  const fetchAirMenuMonth = useCallback(async (month: string) => {
    try {
      await mod.fetchAirMenuMonth.execute(month);
    } finally {
      await load(true);
    }
  }, [mod, load]);

  const analysis: Analysis | null = useMemo(() => (data ? buildAnalysis(data) : null), [data]);
  const forecastData = isCurrentMonth && forecast?.status === "ready" ? forecast.forecast : null;

  return {
    today, filters, setFilters, range, problem,
    data, analysis, loading, error, reload: () => load(),
    forecast: forecastData, forecastPending: isCurrentMonth && (forecast === null || forecast.status === "pending") && !forecastError, forecastError, isCurrentMonth,
    fetchAirMenuMonth,
  };
}
