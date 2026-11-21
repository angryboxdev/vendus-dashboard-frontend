import { useState } from "react";
import {
  AlertBanner, Button, FIELD, PageShell, SECTION_TITLE, SURFACE, SegmentedControl, Skeleton, TABLE, TD, TH, THEAD, TR,
} from "../../../../components/ui/index.ts";
import { CHANNEL_LABEL, type AirMenuMonthStatus, type SalesAnalysisData, type SalesForecast, type SourceSelection } from "../../domain/entities/sales-analysis.ts";
import type { Analysis } from "../../domain/services/analysis.service.ts";
import {
  WEEKDAYS, WEEKDAYS_SHORT, WEEK_ORDER, eur, fmtCount, fmtDate, monthLabel, type Preset,
} from "../../domain/services/periods.ts";
import { Delta } from "./Delta.tsx";
import { SalesAnalysisDetail, type Detail } from "./SalesAnalysisDetail.tsx";
import { useSalesAnalysis, type Filters } from "./use-sales-analysis.ts";

const CLICK = "cursor-pointer transition-shadow hover:shadow-pop hover:ring-1 hover:ring-brand-500/40";

export function SalesAnalysisView() {
  const s = useSalesAnalysis();
  const [stack, setStack] = useState<Detail[]>([]);
  const open = (d: Detail) => setStack([d]);
  const a = s.analysis;

  return (
    <PageShell
      title="Análise de Vendas"
      description={s.data ? rangeLabel(s.data) : "Vendas por dia, hora e canal da loja principal."}
      actions={<SourcePicker value={s.filters.source} onChange={(source) => s.setFilters({ ...s.filters, source })} />}
      tabs={<div className="pb-3"><PeriodPicker filters={s.filters} today={s.today} onChange={s.setFilters} /></div>}
    >
      {s.problem && <AlertBanner tone="warning" title="Período inválido">{s.problem}</AlertBanner>}
      {s.error && <AlertBanner tone="danger" title="Não foi possível carregar" action={<Button variant="secondary" onClick={() => void s.reload()}>Tentar novamente</Button>}>{s.error}</AlertBanner>}
      {s.data && <DataStatus data={s.data} onFetchMonth={s.fetchAirMenuMonth} />}

      {s.loading && !a ? <LoadingState /> : a && s.data ? (
        <>
          <KpiCards a={a} forecast={s.forecast} forecastPending={s.forecastPending} forecastError={s.forecastError} isCurrentMonth={s.isCurrentMonth} onForecast={() => open({ kind: "forecast" })} />

          <section className={`${SURFACE} p-4`}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className={SECTION_TITLE}>Receita por dia <span className="font-normal text-ink-muted">— clique numa barra para ver o dia</span></h2>
              <p className="text-xs text-ink-secondary">
                <span className="inline-block h-2 w-3 rounded-sm bg-brand-600 align-middle" /> período · <span className="inline-block h-0.5 w-3 bg-navy-900 align-middle" /> mês anterior
                {s.forecast && <> · <span className="inline-block h-2 w-3 rounded-sm border border-dashed border-brand-600 align-middle" /> previsão</>}
                {" "}· número = vendas do dia
              </p>
            </div>
            <DailyChart a={a} forecast={s.forecast} onDay={(date) => open({ kind: "day", date })} />
          </section>

          <div className="grid gap-4 lg:grid-cols-3">
            <Highlights a={a} open={open} />
            <section className={`${SURFACE} p-4`}>
              <h2 className={SECTION_TITLE}>Média por dia da semana</h2>
              <BarsH
                legend="traço = ano anterior"
                rows={a.weekday.map((w) => ({ key: w.weekday, label: WEEKDAYS[w.weekday]!, value: w.avgCents, prev: w.prevYearAvgCents, count: w.avgCount }))}
                onRow={(weekday) => open({ kind: "weekday", weekday })}
              />
            </section>
            <section className={`${SURFACE} p-4`}>
              <h2 className={SECTION_TITLE}>Por hora (média por dia)</h2>
              <BarsH compact rows={a.hours.map((h) => ({ key: h.hour, label: `${h.hour}h`, value: h.avgPerDayCents, count: h.avgCountPerDay, muted: h.outside }))} onRow={(hour) => open({ kind: "hour", hour })} />
            </section>
          </div>

          <section className={`${SURFACE} overflow-x-auto p-4`}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className={SECTION_TITLE}>Mapa de calor — dia da semana × hora</h2>
              <p className="text-xs text-ink-secondary">média por dia · número = vendas · tracejado = sem vendas no horário · clique numa célula</p>
            </div>
            <Heatmap a={a} onCell={(weekday, hour) => open({ kind: "slot", weekday, hour })} onWeekday={(weekday) => open({ kind: "weekday", weekday })} onHour={(hour) => open({ kind: "hour", hour })} />
          </section>

          <section className={`${SURFACE} overflow-x-auto`}>
            <table className={TABLE}>
              <thead className={THEAD}>
                <tr>
                  <th className={TH}>Canal</th><th className={`${TH} text-right`}>Receita bruta</th><th className={`${TH} text-right`}>Peso</th>
                  <th className={`${TH} text-right`}>Vendas</th><th className={`${TH} text-right`}>Ticket</th><th className={`${TH} text-right`}>vs. ano anterior</th><th className={`${TH} text-right`}>Hora de pico</th>
                </tr>
              </thead>
              <tbody>
                {a.channels.map((c) => (
                  <tr key={c.channel} className={`${TR} cursor-pointer`} onClick={() => open({ kind: "channel", channel: c.channel })}>
                    <td className={`${TD} font-medium text-brand-600`}>{CHANNEL_LABEL[c.channel]} →</td>
                    <td className={`${TD} text-right tabular-nums`}>{eur(c.grossCents)}</td>
                    <td className={`${TD} text-right tabular-nums`}>{(c.share * 100).toFixed(0)} %</td>
                    <td className={`${TD} text-right tabular-nums`}>{c.count.toLocaleString("pt-PT")}</td>
                    <td className={`${TD} text-right tabular-nums`}>{c.count > 0 ? eur(c.grossCents / c.count, 2) : "—"}</td>
                    <td className={`${TD} text-right`}><Delta cur={c.grossCents} prev={c.prevYearGrossCents} /></td>
                    <td className={`${TD} text-right tabular-nums`}>{c.peakHour !== null ? `${c.peakHour}h` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <SalesAnalysisDetail stack={stack} setStack={setStack} data={s.data} analysis={a} forecast={s.forecast} />
        </>
      ) : null}
    </PageShell>
  );
}

// ─── Filtros ────────────────────────────────────────────────────────────────

function SourcePicker({ value, onChange }: { value: SourceSelection; onChange: (s: SourceSelection) => void }) {
  return (
    <SegmentedControl label="Fonte dos dados" value={value} onChange={onChange}
      items={[{ key: "vendus", label: "Vendus" }, { key: "airmenu", label: "AirMenu" }, { key: "both", label: "Ambas" }]} />
  );
}

function PeriodPicker({ filters, today, onChange }: { filters: Filters; today: string; onChange: (f: Filters) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <SegmentedControl<Preset> label="Período" value={filters.preset} onChange={(preset) => onChange({ ...filters, preset })}
        items={[{ key: "this_month", label: "Este mês" }, { key: "last_month", label: "Mês anterior" }, { key: "this_year", label: "Este ano" }, { key: "custom", label: "Personalizado" }]} />
      {filters.preset === "custom" && (
        <div className="flex items-center gap-1.5 text-sm text-ink-secondary">
          <input type="date" aria-label="De" className={`${FIELD} !w-auto !py-1`} value={filters.custom.from} max={today}
            onChange={(e) => onChange({ ...filters, custom: { ...filters.custom, from: e.target.value } })} />
          até
          <input type="date" aria-label="Até" className={`${FIELD} !w-auto !py-1`} value={filters.custom.to} max={today}
            onChange={(e) => onChange({ ...filters, custom: { ...filters.custom, to: e.target.value } })} />
          <span className="text-xs text-ink-muted">máx. 12 meses</span>
        </div>
      )}
    </div>
  );
}

function rangeLabel(d: SalesAnalysisData): string {
  return `${fmtDate(d.range.from, false)} – ${fmtDate(d.range.to, false)} · comparado com ${fmtDate(d.prevYearRange.from, false)} – ${fmtDate(d.prevYearRange.to, false)}`;
}

// ─── Estado dos dados (preenchimento Vendus, meses AirMenu) ─────────────────

const MONTH_STATE: Record<AirMenuMonthStatus["state"], string> = {
  stored: "guardado",
  partial: "incompleto",
  missing: "sem dados",
  fetching: "a buscar…",
  error: "erro",
};

function DataStatus({ data, onFetchMonth }: { data: SalesAnalysisData; onFetchMonth: (month: string) => Promise<void> }) {
  const fill = data.vendus?.fill;
  const currentMonth = data.today.slice(0, 7);
  return (
    <>
      {data.vendus && data.vendus.missingDays > 0 && (
        <AlertBanner tone="info" title="A preparar os dados da Vendus">
          {fill?.running
            ? `A guardar os dias em falta: ${fill.doneDays} de ${fill.totalDays}. A página atualiza sozinha; os dias já guardados não voltam a ser pedidos.`
            : `${data.vendus.missingDays} dia(s) ainda por guardar — o pedido foi feito e a página atualiza sozinha.`}
          {fill?.lastError && <span className="block text-xs text-ink-secondary">Alguns dias falharam e serão pedidos de novo na próxima abertura.</span>}
        </AlertBanner>
      )}
      {data.vendus?.todayLive === false && (
        <AlertBanner tone="warning" title="Vendas de hoje indisponíveis">A Vendus não respondeu; os dias anteriores estão completos.</AlertBanner>
      )}
      {data.airMenu && (
        <div className={`${SURFACE} flex flex-wrap items-center gap-2 p-3 text-sm`}>
          <span className="font-medium text-navy-900">AirMenu</span>
          <span className="text-xs text-ink-secondary">Só é consultada quando clica em «Buscar». Os dias já guardados nunca voltam a ser pedidos.</span>
          <div className="flex w-full flex-wrap gap-2">
            {data.airMenu.months.map((m) => {
              const canFetch = m.state !== "fetching" && (m.state !== "stored" || m.month === currentMonth);
              return (
                <span key={m.month} className="inline-flex items-center gap-2 rounded-xl bg-surface-soft px-2.5 py-1">
                  <span className="first-letter:uppercase">{monthLabel(m.month)}</span>
                  <span className={`text-xs ${m.state === "stored" ? "text-emerald-700" : m.state === "error" ? "text-red-700" : "text-ink-secondary"}`}>{MONTH_STATE[m.state]}</span>
                  {canFetch && (
                    <button type="button" className="text-xs font-medium text-brand-600 hover:underline" onClick={() => void onFetchMonth(m.month)}>
                      {m.state === "stored" ? "Atualizar hoje" : "Buscar"}
                    </button>
                  )}
                </span>
              );
            })}
          </div>
          {data.airMenu.months.some((m) => m.state === "error") && <p className="w-full text-xs text-red-700">A AirMenu não respondeu. Tente novamente mais tarde.</p>}
          {data.airMenu.comparisonMissingMonths.length > 0 && (
            <p className="w-full text-xs text-ink-secondary">
              Sem dados da AirMenu para a comparação: {data.airMenu.comparisonMissingMonths.map(monthLabel).join(", ")} — busque esses meses para comparar as plataformas.
            </p>
          )}
        </div>
      )}
    </>
  );
}

function LoadingState() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="A carregar">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-28" />)}</div>
      <Skeleton className="h-64" />
      <div className="grid gap-4 lg:grid-cols-3"><Skeleton className="h-72" /><Skeleton className="h-72" /><Skeleton className="h-72" /></div>
    </div>
  );
}

// ─── Cartões ────────────────────────────────────────────────────────────────

function KpiCards({ a, forecast, forecastPending, forecastError, isCurrentMonth, onForecast }: {
  a: Analysis; forecast: SalesForecast | null; forecastPending: boolean; forecastError: string | null; isCurrentMonth: boolean; onForecast: () => void;
}) {
  const kpis = [
    { label: "Receita bruta", cur: a.totals.grossCents, prev: a.prevYear.grossCents, text: eur(a.totals.grossCents), prevText: eur(a.prevYear.grossCents), sub: `Líquida ${eur(a.totals.netCents)}` },
    { label: "N.º de vendas", cur: a.totals.count, prev: a.prevYear.count, text: a.totals.count.toLocaleString("pt-PT"), prevText: a.prevYear.count.toLocaleString("pt-PT") },
    { label: "Ticket médio", cur: a.totals.avgTicketCents, prev: a.prevYear.avgTicketCents, text: eur(a.totals.avgTicketCents, 2), prevText: eur(a.prevYear.avgTicketCents, 2) },
    { label: "Média diária", cur: a.totals.avgDailyCents, prev: a.prevYear.avgDailyCents, text: eur(a.totals.avgDailyCents), prevText: eur(a.prevYear.avgDailyCents), sub: `${fmtCount(a.totals.avgDailyCount)} vendas por dia` },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      {kpis.map((k) => (
        <div key={k.label} className={`${SURFACE} p-4`}>
          <p className="text-xs font-medium text-ink-secondary">{k.label}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-navy-900">{k.text}</p>
          <p className="mt-1 text-xs text-ink-secondary"><Delta cur={k.cur} prev={k.prev} /> · ano anterior {k.prevText}</p>
          {k.sub && <p className="mt-0.5 text-xs text-ink-muted">{k.sub}</p>}
        </div>
      ))}
      {forecast ? (
        <button type="button" onClick={onForecast} className={`${SURFACE} ${CLICK} border-dashed !border-brand-600 p-4 text-left`}>
          <p className="text-xs font-medium text-ink-secondary">
            Previsão do mês{" "}
            <span className="ml-1 rounded bg-brand-100 px-1 text-[10px] font-semibold text-brand-600">{forecast.method === "ai" ? "IA" : "estimativa"}</span>
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-navy-900">{eur(forecast.expectedTotalCents)}</p>
          <p className="mt-1 text-xs text-ink-secondary">entre {eur(forecast.lowTotalCents)} e {eur(forecast.highTotalCents)}</p>
          <p className="mt-0.5 text-xs text-brand-600">ver dia a dia →</p>
        </button>
      ) : (
        <div className={`${SURFACE} p-4`}>
          <p className="text-xs font-medium text-ink-secondary">Previsão do mês</p>
          <p className="mt-2 text-xs text-ink-muted">
            {!isCurrentMonth ? "Só no mês corrente («Este mês»)." : forecastError ?? (forecastPending ? "A preparar a previsão (é preciso o histórico das últimas semanas)…" : "—")}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Destaques e barras ─────────────────────────────────────────────────────

function Highlights({ a, open }: { a: Analysis; open: (d: Detail) => void }) {
  const ph = a.peakHour;
  const wh = a.weakestHour;
  return (
    <section className={`${SURFACE} p-4`}>
      <h2 className={SECTION_TITLE}>Destaques</h2>
      <div className="mt-3 space-y-1 text-sm">
        <Highlight onClick={() => open({ kind: "day", date: a.strongest.date })} label="Dia mais forte" value={eur(a.strongest.grossCents)} detail={`${fmtDate(a.strongest.date)} · ${a.strongest.count} vendas`} tone="good" />
        <Highlight onClick={() => open({ kind: "day", date: a.weakest.date })} label="Dia mais fraco" value={eur(a.weakest.grossCents)} detail={`${fmtDate(a.weakest.date)} · ${a.weakest.count} vendas`} tone="bad" />
        {ph && <Highlight onClick={() => open({ kind: "hour", hour: ph.hour })} label="Hora de pico" value={`${ph.hour}h–${ph.hour + 1}h`}
          detail={`${ph.count.toLocaleString("pt-PT")} vendas no período (${fmtCount(ph.avgCountPerDay)} por dia) · ${eur(ph.avgPerDayCents)} por dia`} tone="good" />}
        {wh && <Highlight onClick={() => open({ kind: "hour", hour: wh.hour })} label="Hora mais fraca" value={`${wh.hour}h–${wh.hour + 1}h`}
          detail={`${wh.count.toLocaleString("pt-PT")} vendas no período (${fmtCount(wh.avgCountPerDay)} por dia) · ${eur(wh.avgPerDayCents)} por dia`} tone="bad" />}
        {a.silentSlots.length > 0 && (
          <Highlight onClick={() => open({ kind: "slot", weekday: a.silentSlots[0]!.weekday, hour: a.silentSlots[0]!.hour })} label="Horas sem vendas" value={`${a.silentSlots.length} faixa(s)`}
            detail={a.silentSlots.slice(0, 8).map((x) => `${WEEKDAYS_SHORT[x.weekday]} ${x.hour}h`).join(", ") + (a.silentSlots.length > 8 ? "…" : "")} tone="bad" />
        )}
        <Highlight label="Fora do horário" value={eur(a.outsideHoursCents)} detail={`${a.outsideHoursCount} vendas · incluídas nos totais`} />
        {a.zeroDays.length > 0 && <Highlight onClick={() => open({ kind: "day", date: a.zeroDays[0]! })} label="Dias sem vendas" value={String(a.zeroDays.length)} detail={a.zeroDays.slice(0, 6).map((d) => fmtDate(d)).join(", ")} tone="bad" />}
      </div>
    </section>
  );
}

function Highlight({ label, value, detail, tone, onClick }: { label: string; value: string; detail: string; tone?: "good" | "bad"; onClick?: () => void }) {
  const bar = tone === "good" ? "bg-emerald-500" : tone === "bad" ? "bg-red-400" : "bg-line";
  const body = (
    <>
      <span className={`w-1 shrink-0 self-stretch rounded-full ${bar}`} />
      <span className="min-w-0 flex-1">
        <span className="block text-xs text-ink-secondary">{label}</span>
        <span className="block font-semibold tabular-nums text-navy-900">{value}</span>
        <span className="block text-xs text-ink-muted">{detail}</span>
      </span>
      {onClick && <span className="self-center text-brand-600" aria-hidden="true">→</span>}
    </>
  );
  return onClick
    ? <button type="button" onClick={onClick} className="flex w-full gap-3 rounded-lg p-1.5 text-left hover:bg-surface-soft">{body}</button>
    : <div className="flex gap-3 p-1.5">{body}</div>;
}

function BarsH({ rows, compact, onRow, legend }: {
  rows: { key: number; label: string; value: number; prev?: number; count: number; muted?: boolean }[]; compact?: boolean; onRow: (k: number) => void; legend?: string;
}) {
  const max = Math.max(...rows.map((r) => Math.max(r.value, r.prev ?? 0)), 1);
  return (
    <div className="mt-3">
      <div className="grid grid-cols-[4.5rem_1fr_4.5rem_3.5rem] gap-2 px-1 pb-1 text-[10px] text-ink-muted"><span /><span>{legend}</span><span className="text-right">receita</span><span className="text-right">vendas</span></div>
      <div className={compact ? "space-y-0.5" : "space-y-1"}>
        {rows.map((r) => (
          <button key={r.key} type="button" onClick={() => onRow(r.key)} className="grid w-full grid-cols-[4.5rem_1fr_4.5rem_3.5rem] items-center gap-2 rounded px-1 py-0.5 text-left text-xs hover:bg-surface-soft">
            <span className={r.muted ? "text-ink-muted" : "text-ink-secondary"}>{r.label}</span>
            <span className="relative block h-3 rounded bg-surface-soft">
              <span className={`block h-3 rounded ${r.muted ? "bg-ink-muted/40" : "bg-brand-600"}`} style={{ width: `${Math.max(0, (r.value / max) * 100)}%` }} />
              {r.prev !== undefined && <span className="absolute top-[-2px] block h-4 w-0.5 bg-navy-900" style={{ left: `${Math.max(0, (r.prev / max) * 100)}%` }} title="ano anterior" />}
            </span>
            <span className="text-right tabular-nums text-ink">{eur(r.value)}</span>
            <span className="text-right tabular-nums text-ink-secondary">{fmtCount(r.count)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Gráfico diário ─────────────────────────────────────────────────────────

function DailyChart({ a, forecast, onDay }: { a: Analysis; forecast: SalesForecast | null; onDay: (d: string) => void }) {
  const W = 1000, H = 190, TOP = 16;
  const realDates = new Set(a.days.map((d) => d.date));
  const bars = [
    ...a.days.map((d) => ({ date: d.date, g: d.grossCents, c: d.count, pm: d.prevMonthGrossCents, pmc: d.prevMonthCount, fc: null as null | { lo: number; hi: number } })),
    // Hoje está nos dias reais (parcial); a previsão acrescenta só os dias seguintes.
    ...(forecast?.days ?? []).filter((f) => !realDates.has(f.date)).map((f) => ({ date: f.date, g: f.expectedCents, c: f.expectedCount, pm: 0, pmc: 0, fc: { lo: f.lowCents, hi: f.highCents } })),
  ];
  const n = bars.length;
  const max = Math.max(...bars.map((d) => Math.max(d.g, d.pm, d.fc?.hi ?? 0)), 1);
  const bw = W / n;
  const y = (v: number) => TOP + (H - TOP) - (Math.max(0, v) / max) * (H - TOP);
  const line = bars.filter((b) => !b.fc).map((d, i) => `${i === 0 ? "M" : "L"}${(i + 0.5) * bw},${y(d.pm)}`).join(" ");
  const showCounts = n <= 35;
  return (
    <svg viewBox={`0 0 ${W} ${H + 20}`} className="mt-3 h-60 w-full" preserveAspectRatio="none" role="img" aria-label="Receita por dia">
      {bars.map((d, i) => {
        const x = i * bw + bw * 0.15;
        const w = bw * 0.7;
        const cls = d.fc ? "fill-brand-100 stroke-brand-600" : d.date === a.strongest.date ? "fill-emerald-600" : d.date === a.weakest.date ? "fill-red-400" : "fill-brand-600";
        return (
          <g key={d.date} className="cursor-pointer" onClick={() => onDay(d.date)}>
            <rect x={i * bw} y={0} width={bw} height={H} fill="transparent" />
            {d.fc && <rect x={x + w / 2 - 1} y={y(d.fc.hi)} width={2} height={Math.max(0, y(d.fc.lo) - y(d.fc.hi))} className="fill-brand-600/40" />}
            <rect className={cls} x={x} y={y(d.g)} width={w} height={H - y(d.g)} strokeDasharray={d.fc ? "4 3" : undefined} strokeWidth={d.fc ? 1.5 : 0} vectorEffect="non-scaling-stroke" />
            {showCounts && <text x={i * bw + bw / 2} y={y(d.g) - 4} textAnchor="middle" className={`text-[10px] ${d.fc ? "fill-brand-600" : "fill-ink-secondary"}`}>{d.fc ? `~${d.c}` : d.c}</text>}
            <title>{d.fc
              ? `${fmtDate(d.date)} — PREVISÃO ${eur(d.g)} (${eur(d.fc.lo)}–${eur(d.fc.hi)}) · ~${d.c} vendas`
              : `${fmtDate(d.date)}: ${eur(d.g)} · ${d.c} vendas — mês anterior ${eur(d.pm)} · ${d.pmc} vendas`}</title>
          </g>
        );
      })}
      <path d={line} fill="none" className="pointer-events-none stroke-navy-900" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      {n <= 62 && bars.map((d, i) => (i % Math.ceil(n / 16) === 0 ? <text key={d.date} x={(i + 0.5) * bw} y={H + 15} textAnchor="middle" className="fill-ink-muted text-[11px]">{d.date.slice(8)}</text> : null))}
    </svg>
  );
}

// ─── Mapa de calor ──────────────────────────────────────────────────────────

/** Intensidade com o token da marca (sem HEX). */
function heatColor(v: number, max: number): string {
  if (v <= 0 || max <= 0) return "rgb(var(--surface-soft))";
  return `rgb(var(--brand-600) / ${(0.08 + 0.92 * Math.sqrt(v / max)).toFixed(2)})`;
}

function Heatmap({ a, onCell, onWeekday, onHour }: { a: Analysis; onCell: (wd: number, h: number) => void; onWeekday: (wd: number) => void; onHour: (h: number) => void }) {
  const silent = new Set(a.silentSlots.map((x) => `${x.weekday}-${x.hour}`));
  const hourList = a.hours.map((h) => h.hour);
  return (
    <table className="mt-3 w-full border-separate border-spacing-1 text-xs">
      <thead>
        <tr><th />{hourList.map((h) => <th key={h} className="font-normal text-ink-secondary"><button type="button" className="hover:text-brand-600 hover:underline" onClick={() => onHour(h)}>{h}h</button></th>)}</tr>
      </thead>
      <tbody>
        {WEEK_ORDER.map((wd) => (
          <tr key={wd}>
            <th className="pr-2 text-left font-normal text-ink-secondary"><button type="button" className="hover:text-brand-600 hover:underline" onClick={() => onWeekday(wd)}>{WEEKDAYS_SHORT[wd]}</button></th>
            {hourList.map((h, i) => {
              const v = a.heat[wd]![i]!;
              const c = a.heatCount[wd]![i]!;
              const dark = a.heatMax > 0 && v / a.heatMax > 0.55;
              return (
                <td key={h} title={`${WEEKDAYS[wd]} ${h}h: ${eur(v)} e ${fmtCount(c)} vendas por dia`} onClick={() => onCell(wd, h)}
                  className={`h-9 min-w-9 cursor-pointer rounded text-center text-[10px] tabular-nums hover:outline hover:outline-2 hover:outline-navy-900 ${silent.has(`${wd}-${h}`) ? "border border-dashed border-red-400" : ""} ${dark ? "text-white" : "text-ink-secondary"}`}
                  style={{ background: heatColor(v, a.heatMax) }}>
                  {c > 0 ? fmtCount(c) : ""}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
