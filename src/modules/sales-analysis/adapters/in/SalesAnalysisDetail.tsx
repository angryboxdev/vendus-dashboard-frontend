import type { ReactNode } from "react";
import { Drawer, SECTION_TITLE, TABLE, TD, TH, THEAD, TR } from "../../../../components/ui/index.ts";
import {
  CHANNEL_LABEL, CHANNEL_SHORT, closingHour,
  type SalesAnalysisData, type SalesChannel, type SalesForecast,
} from "../../domain/entities/sales-analysis.ts";
import { currentBuckets, hourRows, isOutsideHours, type Analysis, type Bucket, type HourRow } from "../../domain/services/analysis.service.ts";
import { WEEKDAYS, WEEK_ORDER, eur, fmtCount, fmtDate, shiftMonth, weekdayOf } from "../../domain/services/periods.ts";
import { Delta } from "./Delta.tsx";

export type Detail =
  | { kind: "day"; date: string }
  | { kind: "weekday"; weekday: number }
  | { kind: "hour"; hour: number }
  | { kind: "slot"; weekday: number; hour: number }
  | { kind: "channel"; channel: SalesChannel }
  | { kind: "forecast" };

interface Ctx {
  data: SalesAnalysisData;
  analysis: Analysis;
  buckets: Bucket[];
  hourList: number[];
  forecast: SalesForecast | null;
  open: (d: Detail) => void;
}

export function SalesAnalysisDetail({ stack, setStack, data, analysis, forecast }: {
  stack: Detail[]; setStack: (s: Detail[]) => void; data: SalesAnalysisData; analysis: Analysis; forecast: SalesForecast | null;
}) {
  const cur = stack[stack.length - 1];
  const ctx: Ctx = { data, analysis, buckets: currentBuckets(data), hourList: analysis.hours.map((h) => h.hour), forecast, open: (d) => setStack([...stack, d]) };
  let title: ReactNode = "";
  let body: ReactNode = null;
  if (cur?.kind === "day") { title = fmtDate(cur.date); body = <DayDetail ctx={ctx} date={cur.date} />; }
  if (cur?.kind === "weekday") { title = `${WEEKDAYS[cur.weekday]} — todos no período`; body = <WeekdayDetail ctx={ctx} weekday={cur.weekday} />; }
  if (cur?.kind === "hour") { title = `Das ${cur.hour}h às ${cur.hour + 1}h`; body = <HourDetail ctx={ctx} hour={cur.hour} />; }
  if (cur?.kind === "slot") { title = `${WEEKDAYS[cur.weekday]}, ${cur.hour}h–${cur.hour + 1}h`; body = <SlotDetail ctx={ctx} weekday={cur.weekday} hour={cur.hour} />; }
  if (cur?.kind === "channel") { title = CHANNEL_LABEL[cur.channel]; body = <ChannelDetail ctx={ctx} channel={cur.channel} />; }
  if (cur?.kind === "forecast") { title = "Previsão do resto do mês"; body = <ForecastDetail ctx={ctx} />; }
  return (
    <Drawer open={!!cur} title={title} onClose={() => setStack([])} width="max-w-2xl"
      description={stack.length > 1 ? <button type="button" onClick={() => setStack(stack.slice(0, -1))} className="text-sm font-medium text-brand-600 hover:underline">← Voltar</button> : undefined}>
      <div className="space-y-5">{body}</div>
    </Drawer>
  );
}

const sumG = (bs: Bucket[]) => bs.reduce((s, b) => s + b.grossCents, 0);
const sumC = (bs: Bucket[]) => bs.reduce((s, b) => s + b.count, 0);

function Kpis({ items }: { items: { label: string; value: string; extra?: ReactNode }[] }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {items.map((i) => (
        <div key={i.label} className="rounded-xl bg-surface-soft px-3 py-2">
          <p className="text-[11px] text-ink-secondary">{i.label}</p>
          <p className="font-semibold tabular-nums text-navy-900">{i.value}</p>
          {i.extra && <p className="text-[11px]">{i.extra}</p>}
        </div>
      ))}
    </div>
  );
}

function ListBar({ label, value, max, right, onClick, empty }: { label: string; value: number; max: number; right: string; onClick: () => void; empty?: boolean }) {
  return (
    <button type="button" onClick={onClick} className="grid w-full grid-cols-[7rem_1fr_5rem_5rem] items-center gap-2 rounded-lg px-2 py-1 text-left text-sm hover:bg-surface-soft">
      <span className="text-ink-secondary">{label}</span>
      {empty ? <span className="text-xs text-red-700">sem vendas</span> : (
        <span className="block h-2.5 rounded bg-surface-soft"><span className="block h-2.5 rounded bg-brand-600" style={{ width: `${Math.max(0, (value / max) * 100)}%` }} /></span>
      )}
      <span className="text-right tabular-nums">{eur(value)}</span>
      <span className="text-right text-xs tabular-nums text-ink-secondary">{right}</span>
    </button>
  );
}

/** Tabela hora a hora: receita, n.º de vendas, ticket e canais. */
function HourTable({ rows, avg, weekday, onHour }: { rows: HourRow[]; avg?: boolean; weekday?: number; onHour?: (h: number) => void }) {
  const max = Math.max(...rows.map((r) => r.grossCents), 1);
  const outside = (h: number) => (weekday === undefined ? h < 12 : isOutsideHours(weekday, h));
  const inside = rows.filter((r) => !outside(r.hour) && r.grossCents > 0);
  const peak = inside.length ? inside.reduce((p, r) => (r.grossCents > p.grossCents ? r : p)) : null;
  const weak = inside.length ? inside.reduce((p, r) => (r.grossCents < p.grossCents ? r : p)) : null;
  return (
    <div className="overflow-x-auto">
      <table className={TABLE}>
        <thead className={THEAD}>
          <tr><th className={TH}>Hora</th><th className={TH}>{avg ? "Receita (média/dia)" : "Receita"}</th><th className={`${TH} text-right`}>{avg ? "Vendas/dia" : "Vendas"}</th><th className={`${TH} text-right`}>Ticket</th><th className={TH}>Canais</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const out = outside(r.hour);
            const silent = !out && r.grossCents === 0 && r.count === 0;
            return (
              <tr key={r.hour} className={`${TR} ${onHour ? "cursor-pointer" : ""}`} onClick={onHour ? () => onHour(r.hour) : undefined}>
                <td className={`${TD} !py-1.5 whitespace-nowrap ${out ? "text-ink-muted" : ""}`}>
                  {r.hour}h
                  {r === peak && <span className="ml-1 rounded bg-emerald-100 px-1 text-[10px] text-emerald-800">pico</span>}
                  {r === weak && r !== peak && <span className="ml-1 rounded bg-red-100 px-1 text-[10px] text-red-800">fraca</span>}
                </td>
                <td className={`${TD} !py-1.5 w-1/2`}>
                  {silent ? <span className="text-xs text-red-700">sem vendas</span> : (
                    <div className="flex items-center gap-2">
                      <div className="h-2.5 flex-1 rounded bg-surface-soft"><div className={`h-2.5 rounded ${out ? "bg-ink-muted/40" : "bg-brand-600"}`} style={{ width: `${Math.max(0, (r.grossCents / max) * 100)}%` }} /></div>
                      <span className="w-16 text-right tabular-nums">{eur(r.grossCents)}</span>
                    </div>
                  )}
                </td>
                <td className={`${TD} !py-1.5 text-right tabular-nums`}>{avg ? fmtCount(r.count) : Math.round(r.count)}</td>
                <td className={`${TD} !py-1.5 text-right tabular-nums`}>{r.count > 0 ? eur(r.grossCents / r.count, 2) : "—"}</td>
                <td className={`${TD} !py-1.5 whitespace-nowrap text-[11px] text-ink-secondary`}>
                  {(Object.entries(r.byChannel) as [SalesChannel, number][]).filter(([, c]) => c !== 0).map(([k, c]) => `${CHANNEL_SHORT[k]} ${avg ? fmtCount(c) : Math.round(c)}`).join(" · ")}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function DayDetail({ ctx, date }: { ctx: Ctx; date: string }) {
  const fc = ctx.forecast?.days.find((d) => d.date === date);
  const bs = ctx.buckets.filter((b) => b.date === date);
  if (fc && date > ctx.data.today) {
    return (
      <p className="rounded-xl border border-dashed border-brand-600 bg-brand-50 px-3 py-2 text-sm text-navy-900">
        Dia ainda por acontecer — <b>previsão</b> de {eur(fc.expectedCents)} (entre {eur(fc.lowCents)} e {eur(fc.highCents)}), cerca de {fc.expectedCount} vendas.
      </p>
    );
  }
  const g = sumG(bs);
  const c = sumC(bs);
  const day = ctx.analysis.days.find((d) => d.date === date);
  const wd = weekdayOf(date);
  const close = closingHour(wd);
  return (
    <>
      <Kpis items={[
        { label: "Receita bruta", value: eur(g) },
        { label: "N.º de vendas", value: String(c) },
        { label: "Ticket médio", value: c > 0 ? eur(g / c, 2) : "—" },
        { label: "Horário", value: `12h00–${close === 23.5 ? "23h30" : "22h30"}` },
      ]} />
      {day && (
        <p className="text-sm text-ink-secondary">
          Mês anterior ({fmtDate(shiftMonth(date, -1))}): <b className="text-navy-900">{eur(day.prevMonthGrossCents)}</b> <Delta cur={g} prev={day.prevMonthGrossCents} />
          {" · "}Ano anterior ({fmtDate(shiftMonth(date, -12))}): <b className="text-navy-900">{eur(day.prevYearGrossCents)}</b> <Delta cur={g} prev={day.prevYearGrossCents} />
        </p>
      )}
      {date === ctx.data.today && <p className="text-xs text-ink-muted">Dia em curso — valores até agora.</p>}
      <section>
        <h3 className={SECTION_TITLE}>Hora a hora</h3>
        <HourTable rows={hourRows(bs, ctx.hourList)} weekday={wd} onHour={(hour) => ctx.open({ kind: "slot", weekday: wd, hour })} />
      </section>
    </>
  );
}

function WeekdayDetail({ ctx, weekday }: { ctx: Ctx; weekday: number }) {
  const days = ctx.analysis.days.filter((d) => weekdayOf(d.date) === weekday);
  const w = ctx.analysis.weekday.find((x) => x.weekday === weekday)!;
  const bs = ctx.buckets.filter((b) => weekdayOf(b.date) === weekday);
  const max = Math.max(...days.map((d) => d.grossCents), 1);
  return (
    <>
      <Kpis items={[
        { label: "Média por dia", value: eur(w.avgCents), extra: <Delta cur={w.avgCents} prev={w.prevYearAvgCents} /> },
        { label: "Vendas por dia", value: fmtCount(w.avgCount) },
        { label: "Dias no período", value: String(days.length) },
        { label: "Ano anterior", value: eur(w.prevYearAvgCents) },
      ]} />
      <section>
        <h3 className={SECTION_TITLE}>Cada {WEEKDAYS[weekday]!.toLowerCase()} <span className="font-normal text-ink-muted">— clique para abrir o dia</span></h3>
        <div className="mt-2 space-y-1">
          {days.map((d) => <ListBar key={d.date} label={fmtDate(d.date, false)} value={d.grossCents} max={max} right={`${d.count} vendas`} empty={d.grossCents === 0} onClick={() => ctx.open({ kind: "day", date: d.date })} />)}
        </div>
      </section>
      <section>
        <h3 className={SECTION_TITLE}>Hora a hora (média por {WEEKDAYS[weekday]!.toLowerCase()})</h3>
        <HourTable rows={hourRows(bs, ctx.hourList, days.length || 1)} avg weekday={weekday} onHour={(hour) => ctx.open({ kind: "slot", weekday, hour })} />
      </section>
    </>
  );
}

function HourDetail({ ctx, hour }: { ctx: Ctx; hour: number }) {
  const h = ctx.analysis.hours.find((x) => x.hour === hour);
  const rows = WEEK_ORDER.map((wd) => {
    const n = ctx.analysis.days.filter((d) => weekdayOf(d.date) === wd).length || 1;
    const bs = ctx.buckets.filter((b) => b.hour === hour && weekdayOf(b.date) === wd);
    return { wd, g: sumG(bs) / n, c: sumC(bs) / n };
  });
  const max = Math.max(...rows.map((r) => r.g), 1);
  return (
    <>
      <Kpis items={[
        { label: "Receita total", value: eur(h?.grossCents ?? 0) },
        { label: "Vendas totais", value: (h?.count ?? 0).toLocaleString("pt-PT") },
        { label: "Média por dia", value: eur(h?.avgPerDayCents ?? 0) },
        { label: "Vendas por dia", value: fmtCount(h?.avgCountPerDay ?? 0) },
      ]} />
      <section>
        <h3 className={SECTION_TITLE}>Por dia da semana <span className="font-normal text-ink-muted">— clique para ver cada dia</span></h3>
        <div className="mt-2 space-y-1">
          {rows.map((r) => <ListBar key={r.wd} label={WEEKDAYS[r.wd]!} value={r.g} max={max} right={`${fmtCount(r.c)} vendas`} onClick={() => ctx.open({ kind: "slot", weekday: r.wd, hour })} />)}
        </div>
      </section>
    </>
  );
}

function SlotDetail({ ctx, weekday, hour }: { ctx: Ctx; weekday: number; hour: number }) {
  const rows = ctx.analysis.days.filter((d) => weekdayOf(d.date) === weekday).map((d) => {
    const bs = ctx.buckets.filter((b) => b.date === d.date && b.hour === hour);
    return { date: d.date, g: sumG(bs), c: sumC(bs) };
  });
  const n = rows.length || 1;
  const max = Math.max(...rows.map((r) => r.g), 1);
  return (
    <>
      <Kpis items={[
        { label: "Média por dia", value: eur(rows.reduce((s, r) => s + r.g, 0) / n) },
        { label: "Vendas por dia", value: fmtCount(rows.reduce((s, r) => s + r.c, 0) / n) },
        { label: "Dias sem vendas", value: String(rows.filter((r) => r.g === 0 && r.c === 0).length) },
        { label: "Fora do horário?", value: isOutsideHours(weekday, hour) ? "Sim" : "Não" },
      ]} />
      <div className="space-y-1">
        {rows.map((r) => <ListBar key={r.date} label={fmtDate(r.date, false)} value={r.g} max={max} right={`${r.c} vendas`} empty={r.g === 0 && r.c === 0} onClick={() => ctx.open({ kind: "day", date: r.date })} />)}
      </div>
    </>
  );
}

function ChannelDetail({ ctx, channel }: { ctx: Ctx; channel: SalesChannel }) {
  const c = ctx.analysis.channels.find((x) => x.channel === channel)!;
  const bs = ctx.buckets.filter((b) => b.channel === channel);
  const perDay = ctx.analysis.days.map((d) => {
    const ds = bs.filter((b) => b.date === d.date);
    return { date: d.date, g: sumG(ds), c: sumC(ds) };
  });
  const max = Math.max(...perDay.map((d) => d.g), 1);
  return (
    <>
      <Kpis items={[
        { label: "Receita bruta", value: eur(c.grossCents), extra: <Delta cur={c.grossCents} prev={c.prevYearGrossCents} /> },
        { label: "N.º de vendas", value: c.count.toLocaleString("pt-PT") },
        { label: "Ticket médio", value: c.count > 0 ? eur(c.grossCents / c.count, 2) : "—" },
        { label: "Peso no total", value: `${(c.share * 100).toFixed(0)} %` },
      ]} />
      <section>
        <h3 className={SECTION_TITLE}>Por dia <span className="font-normal text-ink-muted">— clique numa barra</span></h3>
        <div className="mt-2 flex h-28 items-end gap-px">
          {perDay.map((d) => (
            <button key={d.date} type="button" onClick={() => ctx.open({ kind: "day", date: d.date })} title={`${fmtDate(d.date)}: ${eur(d.g)} · ${d.c} vendas`} aria-label={`${fmtDate(d.date)}: ${eur(d.g)}`}
              className="flex-1 rounded-t-sm bg-brand-600/70 hover:bg-navy-900" style={{ height: `${Math.max(2, (Math.max(0, d.g) / max) * 112)}px` }} />
          ))}
        </div>
      </section>
      <section>
        <h3 className={SECTION_TITLE}>Hora a hora (média por dia)</h3>
        <HourTable rows={hourRows(bs, ctx.hourList, ctx.analysis.days.length)} avg onHour={(hour) => ctx.open({ kind: "hour", hour })} />
      </section>
    </>
  );
}

function ForecastDetail({ ctx }: { ctx: Ctx }) {
  const f = ctx.forecast;
  if (!f) return <p className="text-sm text-ink-secondary">A previsão só existe para o mês corrente.</p>;
  return (
    <>
      <Kpis items={[
        { label: "Vendido até ontem", value: eur(f.actualCents) },
        { label: "Previsão do mês", value: eur(f.expectedTotalCents) },
        { label: "Cenário fraco", value: eur(f.lowTotalCents) },
        { label: "Cenário forte", value: eur(f.highTotalCents) },
      ]} />
      <p className="rounded-xl bg-surface-soft px-3 py-2 text-xs text-ink-secondary">
        <b className="text-navy-900">{f.method === "ai" ? "Feita com IA:" : "Estimativa simples:"}</b>{" "}
        {f.method === "ai"
          ? "para cada dia que falta, a IA olhou para os mesmos dias da semana das últimas semanas (os mais fracos e os mais fortes), para a tendência deste mês e para o mesmo mês do ano passado."
          : "mediana do mesmo dia da semana nas últimas 6 semanas; o intervalo vai do dia mais fraco ao mais forte."}
        {f.note && <span className="mt-1 block">{f.note}</span>}
        <span className="mt-1 block text-ink-muted">É uma estimativa — não é um valor garantido.</span>
      </p>
      <table className={TABLE}>
        <thead className={THEAD}><tr><th className={TH}>Dia</th><th className={`${TH} text-right`}>Previsto</th><th className={`${TH} text-right`}>Intervalo</th><th className={`${TH} text-right`}>Vendas</th></tr></thead>
        <tbody>
          {f.days.map((d) => (
            <tr key={d.date} className={TR}>
              <td className={TD}>{fmtDate(d.date)}{d.date === ctx.data.today && <span className="ml-1 text-[11px] text-ink-muted">(hoje, dia inteiro)</span>}</td>
              <td className={`${TD} text-right tabular-nums`}>{eur(d.expectedCents)}</td>
              <td className={`${TD} text-right text-xs tabular-nums text-ink-secondary`}>{eur(d.lowCents)} – {eur(d.highCents)}</td>
              <td className={`${TD} text-right tabular-nums`}>~{d.expectedCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
