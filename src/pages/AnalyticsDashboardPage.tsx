import { useState, useEffect, useCallback } from "react";
import { apiGet } from "../lib/api";
import { formatEUR } from "../lib/format";

// ---- Types ----

type WeekdayEntry = {
  weekday: number;
  label: string;
  gross: number;
  avg_gross: number;
  days_count: number;
  documents_count: number;
};

type GrowthSlot = {
  year: number;
  month: number;
  label: string;
  gross: number;
  documents_count: number;
};

type AnalyticsCurrentData = {
  period: {
    year: number;
    month: number;
    from: string;
    to: string;
    is_current_month: boolean;
    documents_count: number;
  };
  today: {
    gross: number;
    documents_count: number;
    vs_daily_avg_pct: number;
    is_below_threshold: boolean;
  } | null;
  month: {
    gross: number;
    documents_count: number;
    days_elapsed: number;
    days_in_month: number;
    daily_avg: number;
    expected_gross: number;
    pct_of_expected: number;
    avg_ticket: number;
  };
  by_weekday: WeekdayEntry[];
  debug: { took_ms: number };
};

type PrevMonth = {
  year: number;
  month: number;
  label: string;
  gross: number;
  daily_avg: number;
  avg_ticket: number;
  documents_count: number;
};

type AnalyticsHistoricalData = {
  annual: {
    gross: number;
    year: number;
    documents_count: number;
  };
  historical: {
    gross: number;
    since: string;
    documents_count: number;
  };
  monthly_growth: GrowthSlot[];
  comparisons: {
    prev_month: PrevMonth | null;
    prev_year_ytd: { year: number; gross: number; documents_count: number } | null;
  };
  debug: { took_ms: number; history_start_year: number };
};

// ---- Helpers ----

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function formatPct(value: number, sign = true): string {
  const abs = Math.abs(value);
  const formatted = abs.toFixed(1).replace(".", ",") + "%";
  if (!sign) return formatted;
  return value >= 0 ? `+${formatted}` : `-${formatted}`;
}

function formatDatePt(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

function pctChange(current: number, prev: number): number | null {
  if (prev <= 0) return null;
  return ((current - prev) / prev) * 100;
}

// ---- Comparison line ----

type ComparisonData = { label: string; pct: number; value: string };

function ComparisonLine({ comparison }: { comparison: ComparisonData | "loading" | null }) {
  if (!comparison) return null;
  if (comparison === "loading") {
    return <p className="text-xs text-slate-400 italic">a carregar comparação…</p>;
  }
  const positive = comparison.pct >= 0;
  return (
    <p className="text-xs">
      <span className="text-slate-400">{comparison.label}: </span>
      <span className={`font-medium ${positive ? "text-green-600" : "text-red-500"}`}>
        {formatPct(comparison.pct)}
      </span>
      <span className="text-slate-400"> ({comparison.value})</span>
    </p>
  );
}

// ---- Bar Chart (CSS/Tailwind) ----

function BarChart({
  data, valueKey, labelKey, color,
}: {
  data: Array<Record<string, unknown>>;
  valueKey: string;
  labelKey: string;
  color: string;
}) {
  const values = data.map((d) => Number(d[valueKey]) || 0);
  const max = Math.max(...values, 1);
  return (
    <div className="flex items-end gap-1 h-32">
      {data.map((d, i) => {
        const value = Number(d[valueKey]) || 0;
        const heightPct = (value / max) * 100;
        return (
          <div key={i} className="flex flex-1 flex-col items-center gap-1">
            <div className="w-full flex flex-col justify-end" style={{ height: "96px" }}>
              <div
                title={`${String(d[labelKey])}: ${formatEUR(value)}`}
                className={`w-full rounded-t-sm transition-all duration-300 ${color}`}
                style={{ height: `${heightPct}%`, minHeight: value > 0 ? "4px" : "0" }}
              />
            </div>
            <span className="text-[10px] text-slate-500 leading-none text-center truncate w-full">
              {String(d[labelKey])}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function BarChartSkeleton({ bars = 6 }: { bars?: number }) {
  const heights = [55, 70, 45, 80, 60, 40, 65].slice(0, bars);
  return (
    <div className="flex items-end gap-1 h-32 animate-pulse">
      {heights.map((h, i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-1">
          <div className="w-full flex flex-col justify-end" style={{ height: "96px" }}>
            <div className="w-full rounded-t-sm bg-slate-100" style={{ height: `${h}%` }} />
          </div>
          <div className="h-2 w-full bg-slate-100 rounded" />
        </div>
      ))}
    </div>
  );
}

// ---- Progress Bar ----

function ProgressBar({ pct, color }: { pct: number; color: string }) {
  const clamped = Math.min(Math.max(pct, 0), 100);
  return (
    <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-500 ${color}`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

// ---- Tooltip Icon ----

function TooltipIcon({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative inline-flex">
      <button
        type="button"
        className="ml-1 text-slate-400 hover:text-slate-600 transition-colors"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        aria-label="Informação"
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
        </svg>
      </button>
      {show && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 rounded-lg bg-slate-800 px-3 py-2 text-xs text-white shadow-lg z-10 leading-relaxed">
          {text}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
        </div>
      )}
    </div>
  );
}

// ---- KPI Card ----

type KpiVariant = "purple" | "blue" | "green" | "yellow" | "indigo";

const variantStyles: Record<KpiVariant, { dot: string; badge: string; bar: string; alert: string }> = {
  purple: { dot: "bg-purple-500", badge: "bg-purple-50 text-purple-700", bar: "bg-purple-400", alert: "bg-red-100 text-red-700" },
  blue:   { dot: "bg-blue-500",   badge: "bg-blue-50 text-blue-700",     bar: "bg-blue-500",   alert: "bg-red-100 text-red-700" },
  green:  { dot: "bg-green-500",  badge: "bg-green-50 text-green-700",   bar: "bg-green-400",  alert: "bg-red-100 text-red-700" },
  yellow: { dot: "bg-yellow-400", badge: "bg-yellow-50 text-yellow-700", bar: "bg-yellow-400", alert: "bg-red-100 text-red-700" },
  indigo: { dot: "bg-indigo-500", badge: "bg-indigo-50 text-indigo-700", bar: "bg-indigo-400", alert: "bg-red-100 text-red-700" },
};

function KpiCardSkeleton({ title, badgeLabel, variant }: { title: string; badgeLabel: string; variant: KpiVariant }) {
  const s = variantStyles[variant];
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 flex flex-col gap-3 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className={`w-2.5 h-2.5 rounded-full ${s.dot} opacity-40`} />
          <span className="text-sm font-semibold text-slate-400">{title}</span>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${s.badge} opacity-50`}>{badgeLabel}</span>
      </div>
      <div className="animate-pulse space-y-2">
        <div className="h-8 bg-slate-100 rounded w-2/3" />
        <div className="h-3 bg-slate-100 rounded w-full" />
      </div>
      <div className="h-1.5 w-full rounded-full bg-slate-100 animate-pulse" />
      <div className="h-3 bg-slate-100 rounded w-3/4 animate-pulse" />
    </div>
  );
}

function KpiCard({
  title, badgeLabel, variant, value, subtitle, comparison, progressPct, footerLabel, footerAlert, tooltip,
}: {
  title: string;
  badgeLabel: string;
  variant: KpiVariant;
  value: string;
  subtitle: string;
  comparison?: ComparisonData | "loading" | null;
  progressPct?: number;
  footerLabel: string;
  footerAlert?: boolean;
  tooltip?: string;
}) {
  const s = variantStyles[variant];
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white p-5 flex flex-col gap-3 shadow-sm ${footerAlert ? "ring-2 ring-red-300" : ""}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className={`w-2.5 h-2.5 rounded-full ${s.dot}`} />
          <span className="text-sm font-semibold text-slate-700">{title}</span>
          {tooltip && <TooltipIcon text={tooltip} />}
        </div>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${s.badge}`}>{badgeLabel}</span>
      </div>
      <div>
        <p className="text-3xl font-bold text-slate-900 tracking-tight">{value}</p>
        <p className="text-xs text-slate-500 mt-1">{subtitle}</p>
      </div>
      {comparison !== undefined && <ComparisonLine comparison={comparison ?? null} />}
      {progressPct !== undefined && (
        <ProgressBar pct={progressPct} color={s.bar} />
      )}
      <p className={`text-xs font-medium ${footerAlert ? `${s.alert} -mx-5 -mb-5 px-5 py-2 rounded-b-2xl` : "text-slate-500"}`}>
        {footerLabel}
      </p>
    </div>
  );
}

// ---- Main Page ----

export function AnalyticsDashboardPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);

  const [current, setCurrent] = useState<AnalyticsCurrentData | null>(null);
  const [historical, setHistorical] = useState<AnalyticsHistoricalData | null>(null);
  const [loadingCurrent, setLoadingCurrent] = useState(false);
  const [loadingHistorical, setLoadingHistorical] = useState(false);
  const [errorCurrent, setErrorCurrent] = useState<string | null>(null);
  const [errorHistorical, setErrorHistorical] = useState<string | null>(null);

  const load = useCallback((y: number, m: number) => {
    setCurrent(null);
    setHistorical(null);
    setErrorCurrent(null);
    setErrorHistorical(null);
    setLoadingCurrent(true);
    setLoadingHistorical(true);

    const qs = `year=${y}&month=${m}`;

    apiGet<AnalyticsCurrentData>(`/api/analytics/current?${qs}`)
      .then(setCurrent)
      .catch((e: unknown) => setErrorCurrent(e instanceof Error ? e.message : "Erro desconhecido"))
      .finally(() => setLoadingCurrent(false));

    apiGet<AnalyticsHistoricalData>(`/api/analytics/historical?${qs}`)
      .then(setHistorical)
      .catch((e: unknown) => setErrorHistorical(e instanceof Error ? e.message : "Erro desconhecido"))
      .finally(() => setLoadingHistorical(false));
  }, []);

  useEffect(() => {
    load(year, month);
  }, [load, year, month]);

  function navigateMonth(delta: number) {
    let newMonth = month + delta;
    let newYear = year;
    if (newMonth < 1) { newMonth = 12; newYear -= 1; }
    if (newMonth > 12) { newMonth = 1; newYear += 1; }
    setMonth(newMonth);
    setYear(newYear);
  }

  const c = current;

  // ---- Comparison helpers ----

  // "Faturação hoje" vs média do mesmo dia da semana no mês
  const todayWeekdayComparison: ComparisonData | null = (() => {
    if (!c?.today) return null;
    const jsDay = new Date().getDay();
    const isoWeekday = jsDay === 0 ? 7 : jsDay;
    const entry = c.by_weekday.find((d) => d.weekday === isoWeekday);
    if (!entry || entry.days_count === 0) return null;
    const p = pctChange(c.today.gross, entry.avg_gross);
    if (p === null) return null;
    return { label: `vs. média de ${entry.label}`, pct: p, value: formatEUR(entry.avg_gross) };
  })();

  const histLoading = loadingHistorical && !historical;
  const pm = historical?.comparisons.prev_month ?? null;
  const pyYtd = historical?.comparisons.prev_year_ytd ?? null;

  // Mês vs mês anterior
  const monthComparison: ComparisonData | "loading" | null = histLoading
    ? "loading"
    : pm && c
    ? (() => {
        const p = pctChange(c.month.gross, pm.gross);
        return p !== null ? { label: `vs. ${pm.label}`, pct: p, value: formatEUR(pm.gross) } : null;
      })()
    : null;

  // Média diária vs mês anterior
  const dailyAvgComparison: ComparisonData | "loading" | null = histLoading
    ? "loading"
    : pm && c
    ? (() => {
        const p = pctChange(c.month.daily_avg, pm.daily_avg);
        return p !== null ? { label: `vs. ${pm.label}`, pct: p, value: formatEUR(pm.daily_avg) } : null;
      })()
    : null;

  // Anual vs mesmo período ano anterior
  const annualComparison: ComparisonData | "loading" | null = histLoading
    ? "loading"
    : historical && pyYtd
    ? (() => {
        const p = pctChange(historical.annual.gross, pyYtd.gross);
        return p !== null ? { label: `vs. ${pyYtd.year}`, pct: p, value: formatEUR(pyYtd.gross) } : null;
      })()
    : null;

  // Ticket médio vs mês anterior
  const avgTicketComparison: ComparisonData | "loading" | null = histLoading
    ? "loading"
    : pm && c
    ? (() => {
        const p = pctChange(c.month.avg_ticket, pm.avg_ticket);
        return p !== null ? { label: `vs. ${pm.label}`, pct: p, value: formatEUR(pm.avg_ticket) } : null;
      })()
    : null;

  return (
    <div className="min-h-full bg-slate-50">
      <div className="mx-auto max-w-6xl p-6 flex flex-col gap-6">

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
            <p className="text-sm text-slate-500 mt-0.5">Resumo de faturação</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => navigateMonth(-1)}
              disabled={loadingCurrent}
              className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-40 shadow-sm"
              aria-label="Mês anterior"
            >
              <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </button>
            <span className="min-w-[90px] text-center text-sm font-semibold text-slate-700 flex items-center justify-center gap-1.5">
              {loadingCurrent && (
                <svg className="w-3.5 h-3.5 animate-spin text-blue-500 flex-shrink-0" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              )}
              {String(month).padStart(2, "0")} / {year}
            </span>
            <button
              type="button"
              onClick={() => navigateMonth(1)}
              disabled={loadingCurrent}
              className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-40 shadow-sm"
              aria-label="Próximo mês"
            >
              <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>

        {/* Errors */}
        {errorCurrent && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{errorCurrent}</div>
        )}
        {errorHistorical && (
          <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm text-orange-700">
            Histórico indisponível: {errorHistorical}
          </div>
        )}

        {/* Initial skeleton */}
        {loadingCurrent && !c && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-slate-200 bg-white p-5 h-44 animate-pulse">
                <div className="h-3 bg-slate-100 rounded w-1/2 mb-3" />
                <div className="h-8 bg-slate-100 rounded w-2/3 mb-2" />
                <div className="h-2 bg-slate-100 rounded w-full mt-auto" />
              </div>
            ))}
          </div>
        )}

        {c && (
          <div className={`space-y-6 ${loadingCurrent ? "opacity-40 pointer-events-none transition-opacity duration-200" : "transition-opacity duration-200"}`}>
            {/* Resumo executivo */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-slate-800">Resumo executivo</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Período: {formatDatePt(c.period.from)} a {formatDatePt(c.period.to)}
                    {" "}• {c.period.documents_count} documentos
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500" />Atual</span>
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-yellow-400" />Projetado</span>
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-500" />Média</span>
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-indigo-500" />Histórico</span>
                </div>
              </div>
            </div>

            {/* KPI cards — linha 1 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {c.today ? (
                <KpiCard
                  title="Faturação hoje"
                  badgeLabel="Hoje"
                  variant="purple"
                  value={formatEUR(c.today.gross)}
                  subtitle="Valor bruto registado no dia atual"
                  comparison={todayWeekdayComparison}
                  progressPct={c.today.vs_daily_avg_pct > 0 ? Math.min(c.today.vs_daily_avg_pct, 100) : 0}
                  footerLabel={
                    c.today.vs_daily_avg_pct >= 0
                      ? `+${c.today.vs_daily_avg_pct.toFixed(1).replace(".", ",")}% vs. média diária`
                      : `${c.today.vs_daily_avg_pct.toFixed(1).replace(".", ",")}% vs. média diária`
                  }
                  footerAlert={c.today.is_below_threshold}
                />
              ) : (
                <KpiCard
                  title="Faturação hoje"
                  badgeLabel="Hoje"
                  variant="purple"
                  value="—"
                  subtitle="Não disponível para meses passados"
                  footerLabel="Visualizando mês histórico"
                />
              )}

              <KpiCard
                title="Faturação do mês"
                badgeLabel="Mês"
                variant="blue"
                value={formatEUR(c.month.gross)}
                subtitle={`Acumulado de ${formatDatePt(c.period.from)} a ${formatDatePt(c.period.to)} • ${c.month.documents_count} docs`}
                comparison={monthComparison}
                progressPct={c.month.pct_of_expected}
                footerLabel={`${c.month.pct_of_expected.toFixed(1).replace(".", ",")}% da previsão mensal`}
              />

              <KpiCard
                title="Média diária"
                badgeLabel="Média"
                variant="green"
                value={formatEUR(c.month.daily_avg)}
                subtitle={`Média calculada sobre ${c.month.days_elapsed} dias`}
                comparison={dailyAvgComparison}
                progressPct={100}
                footerLabel="Base para projeção do mês"
              />
            </div>

            {/* KPI cards — linha 2 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <KpiCard
                title="Faturação esperada"
                badgeLabel="Prev."
                variant="yellow"
                value={formatEUR(c.month.expected_gross)}
                subtitle={`Projeção para o final de ${MONTH_NAMES[c.period.month - 1]}`}
                progressPct={c.month.pct_of_expected}
                footerLabel={`Estimativa: média diária × ${c.month.days_in_month} dias`}
                tooltip={`Projeção calculada com a fórmula simples: média diária (${formatEUR(c.month.daily_avg)}) × total de dias do mês (${c.month.days_in_month}). Pressupõe que todos os dias restantes têm o mesmo volume médio.`}
              />

              {histLoading ? (
                <KpiCardSkeleton title="Faturação anual" badgeLabel="Ano" variant="blue" />
              ) : historical ? (
                <KpiCard
                  title="Faturação anual"
                  badgeLabel="Ano"
                  variant="blue"
                  value={formatEUR(historical.annual.gross)}
                  subtitle={`Total bruto acumulado em ${historical.annual.year}`}
                  comparison={annualComparison}
                  progressPct={Math.round((c.period.month / 12) * 100)}
                  footerLabel="Inclui vendas até à data"
                />
              ) : (
                <KpiCard title="Faturação anual" badgeLabel="Ano" variant="blue" value="—" subtitle="Indisponível" footerLabel="" />
              )}

              {histLoading ? (
                <KpiCardSkeleton title="Faturação total" badgeLabel="Total" variant="indigo" />
              ) : historical ? (
                <KpiCard
                  title="Faturação total"
                  badgeLabel="Total"
                  variant="indigo"
                  value={formatEUR(historical.historical.gross)}
                  subtitle={`Histórico bruto desde ${historical.historical.since.split("-")[0]}`}
                  progressPct={100}
                  footerLabel="Visão global de performance"
                />
              ) : (
                <KpiCard title="Faturação total" badgeLabel="Total" variant="indigo" value="—" subtitle="Indisponível" footerLabel="" />
              )}
            </div>

            {/* Ticket médio + leitura rápida */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
                  <span className="text-sm font-semibold text-slate-700">Ticket médio</span>
                </div>
                <div>
                  <p className="text-3xl font-bold text-slate-900">{formatEUR(c.month.avg_ticket)}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Faturação ÷ {c.month.documents_count} documentos{c.today ? " (exc. hoje)" : ""}
                  </p>
                </div>
                <ComparisonLine comparison={avgTicketComparison ?? null} />
              </div>

              <div className="sm:col-span-2 rounded-2xl border border-green-200 bg-green-50 p-5 shadow-sm flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-full bg-green-500 flex-shrink-0" />
                <div className="text-sm text-slate-700">
                  <span className="font-semibold text-green-700">Leitura rápida</span>
                  {" — "}
                  Média diária de {formatEUR(c.month.daily_avg)}
                  {c.today && c.today.is_below_threshold && (
                    <span className="ml-1 text-red-600 font-medium">
                      • Alerta: hoje está {formatPct(Math.abs(c.today.vs_daily_avg_pct), false)} abaixo da média
                    </span>
                  )}
                  {(!c.today || !c.today.is_below_threshold) && (
                    <span className="ml-1 text-slate-500">
                      ; projeção mensal de {formatEUR(c.month.expected_gross)}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Gráficos */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-slate-700 mb-1">Faturação média por dia da semana</h3>
                <p className="text-xs text-slate-500 mb-4">
                  Média de dias completos no período • {formatDatePt(c.period.from)} a {formatDatePt(c.period.to)}
                </p>
                {c.by_weekday.every((d) => d.gross === 0) ? (
                  <p className="text-sm text-slate-400 text-center py-8">Sem dados para o período</p>
                ) : (
                  <>
                    <BarChart
                      data={c.by_weekday as unknown as Array<Record<string, unknown>>}
                      valueKey="avg_gross"
                      labelKey="label"
                      color="bg-purple-400"
                    />
                    <div className="mt-3 grid grid-cols-7 gap-1">
                      {c.by_weekday.map((d) => (
                        <div key={d.weekday} className="text-center">
                          <p className="text-[10px] font-semibold text-slate-700">{formatEUR(d.avg_gross)}</p>
                          <p className="text-[9px] text-slate-400">{d.days_count}d</p>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                  Crescimento mensal
                  {loadingHistorical && (
                    <svg className="w-3 h-3 animate-spin text-blue-400 flex-shrink-0" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                  )}
                </h3>
                <p className="text-xs text-slate-500 mb-4">Faturação bruta — últimos 6 meses</p>
                {histLoading ? (
                  <BarChartSkeleton bars={6} />
                ) : historical ? (
                  <>
                    <BarChart
                      data={historical.monthly_growth as unknown as Array<Record<string, unknown>>}
                      valueKey="gross"
                      labelKey="label"
                      color="bg-blue-400"
                    />
                    <div className="mt-3 grid gap-1" style={{ gridTemplateColumns: `repeat(${historical.monthly_growth.length}, 1fr)` }}>
                      {historical.monthly_growth.map((d, i) => {
                        const prev = i > 0 ? historical.monthly_growth[i - 1].gross : null;
                        const growthPct = prev !== null && prev > 0 ? ((d.gross - prev) / prev) * 100 : null;
                        return (
                          <div key={i} className="text-center">
                            <p className="text-[10px] font-semibold text-slate-700">{formatEUR(d.gross)}</p>
                            {growthPct !== null && (
                              <p className={`text-[9px] font-medium ${growthPct >= 0 ? "text-green-600" : "text-red-500"}`}>
                                {formatPct(growthPct)}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : null}
              </div>
            </div>

            {/* Debug */}
            <p className="text-xs text-slate-400 text-right">
              Mês: {c.debug.took_ms}ms
              {historical && ` • Anual+histórico: ${historical.debug.took_ms}ms`}
              {loadingHistorical && " • a carregar histórico…"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
