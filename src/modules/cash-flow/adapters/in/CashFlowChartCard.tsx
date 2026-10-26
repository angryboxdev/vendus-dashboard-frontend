import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { Link } from "react-router-dom";
import { SURFACE, SECTION_TITLE, buttonClass } from "../../../../components/ui/index.ts";
import type { CashFlowReport } from "../../domain/entities/cash-flow.ts";
import { chartRows, monthName, monthShort, pctChange, totalsUntil } from "../../domain/services/cash-flow-view.ts";
import { Delta } from "./cash-flow-ui.tsx";
import { CHART_COLORS, euros } from "./cash-flow-format.ts";

const TICKS = [1, 8, 15, 22, 29];

function ChartTooltip({ report, day }: { report: CashFlowReport; day: number }) {
  const t = totalsUntil(report, day);
  const outflowPct = pctChange(t.current.outflow, t.previous.outflow);
  const inflowPct = pctChange(t.current.inflow, t.previous.inflow);
  return (
    <div className="min-w-[15rem] rounded-2xl border border-line bg-surface-card px-4 py-3 shadow-pop">
      <p className="text-sm font-semibold text-navy-900">
        {t.currentLabel}
        {t.previousLabel && <span className="font-normal text-ink-secondary"> vs {t.previousLabel}</span>}
      </p>
      <div className="mt-2 grid grid-cols-2 gap-4">
        <div>
          <p className="flex items-center gap-1.5 text-xs text-ink-secondary">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" /> Entradas
          </p>
          <p className="text-base font-semibold tabular-nums text-navy-900">{euros(t.current.inflow)}</p>
          {inflowPct !== null && (
            <p className="text-xs">
              <Delta pct={inflowPct} /> <span className="tabular-nums text-ink-secondary">{euros(t.previous.inflow)}</span>
            </p>
          )}
        </div>
        <div>
          <p className="flex items-center gap-1.5 text-xs text-ink-secondary">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-600" /> Saídas
          </p>
          <p className="text-base font-semibold tabular-nums text-navy-900">{euros(t.current.outflow)}</p>
          {outflowPct !== null && (
            <p className="text-xs">
              <Delta pct={outflowPct} goodWhenDown /> <span className="tabular-nums text-ink-secondary">{euros(t.previous.outflow)}</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/** Cartão principal: resultado do mês, gráfico acumulado (com o período anterior a tracejado) e totais. */
export function CashFlowChartCard({ report }: { report: CashFlowReport }) {
  const { totals, previousTotals, period } = report;
  const prevMonth = monthShort(period.month === 1 ? 12 : period.month - 1);
  const marginDelta =
    totals.marginPct !== null && previousTotals.marginPct !== null ? Math.round(totals.marginPct - previousTotals.marginPct) : null;
  const lastDay = Number(period.to.slice(8, 10));

  return (
    <section className={`${SURFACE} flex flex-col p-6`}>
      <h2 className={`${SECTION_TITLE} first-letter:uppercase`}>{monthName(period.month)}</h2>
      <p className="mt-3 text-sm text-ink-secondary">Resultado</p>
      <p className={`text-4xl font-bold tracking-tight tabular-nums sm:text-[44px] ${totals.netCents < 0 ? "text-rose-600" : "text-navy-900"}`}>
        {euros(totals.netCents)}
      </p>
      {totals.marginPct !== null && (
        <p className="mt-1 text-xs text-ink-secondary">
          Margem <span className="font-semibold text-navy-900 tabular-nums">{Math.round(totals.marginPct)}%</span>{" "}
          {marginDelta !== null && (
            <span className={`font-semibold tabular-nums ${marginDelta >= 0 ? "text-emerald-700" : "text-rose-600"}`}>
              {marginDelta > 0 ? "+" : marginDelta < 0 ? "−" : ""}
              {Math.abs(marginDelta)} p.p.
            </span>
          )}{" "}
          vs {prevMonth}
        </p>
      )}

      <div className="mt-4 h-56 w-full" role="img" aria-label="Entradas e saídas acumuladas ao longo do mês">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartRows(report)} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
            <defs>
              <linearGradient id="cash-flow-inflow" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CHART_COLORS.inflow} stopOpacity={0.18} />
                <stop offset="100%" stopColor={CHART_COLORS.inflow} stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke={CHART_COLORS.grid} strokeDasharray="2 6" />
            <XAxis
              dataKey="day"
              ticks={TICKS}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: CHART_COLORS.axis, fillOpacity: 0.55 }}
            />
            <Tooltip
              cursor={{ stroke: CHART_COLORS.axis, strokeOpacity: 0.25, strokeDasharray: "3 3" }}
              content={({ active, label }) =>
                active && typeof label === "number" && label <= lastDay ? <ChartTooltip report={report} day={label} /> : null
              }
            />
            <Line dataKey="previousInflow" stroke={CHART_COLORS.inflow} strokeOpacity={0.45} strokeDasharray="2 4" dot={false} activeDot={false} isAnimationActive={false} />
            <Line dataKey="previousOutflow" stroke={CHART_COLORS.outflow} strokeOpacity={0.45} strokeDasharray="2 4" dot={false} activeDot={false} isAnimationActive={false} />
            <Area dataKey="inflow" stroke={CHART_COLORS.inflow} strokeWidth={2} fill="url(#cash-flow-inflow)" dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
            <Line dataKey="outflow" stroke={CHART_COLORS.outflow} strokeWidth={2} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-6">
        <div>
          <p className="flex items-center gap-1.5 text-xs text-ink-secondary">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" /> Entradas
          </p>
          <p className="text-lg font-semibold tabular-nums text-navy-900">{euros(totals.inflowCents)}</p>
          <Delta pct={pctChange(totals.inflowCents, previousTotals.inflowCents)} suffix={`vs ${prevMonth}`} />
        </div>
        <div>
          <p className="flex items-center gap-1.5 text-xs text-ink-secondary">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-600" /> Saídas
          </p>
          <p className="text-lg font-semibold tabular-nums text-navy-900">{euros(totals.outflowCents)}</p>
          <Delta pct={pctChange(totals.outflowCents, previousTotals.outflowCents)} goodWhenDown suffix={`vs ${prevMonth}`} />
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <Link to="/financial/bank-statements" className={buttonClass("secondary", "sm")}>
          Ver conciliação bancária
        </Link>
      </div>
    </section>
  );
}
