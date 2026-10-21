import { useState } from "react";
import { useI18n } from "../../../../../i18n/I18nProvider.tsx";
import { TABLE, TD, TH, THEAD, TR } from "../../../../../components/ui/index.ts";
import { formatDuration } from "../../../domain/services/attendance.service.ts";
import type { StatsBucket } from "../../../domain/services/person-overview.service.ts";

/** Cores validadas (dataviz: banda de luminosidade, croma, daltonismo e contraste). */
const WORKED = "#C9643A";
const EXCESS = "#5B6FB8";
const PLANNED = "#F7E8DF";

const H = 220;
const hoursTick = (s: number) => `${Math.round(s / 3600)}h`;
const niceHours = (seconds: number) => {
  const h = Math.max(1, seconds / 3600);
  const p = 10 ** Math.floor(Math.log10(h));
  return ([1, 2, 5, 10].find((m) => m * p >= h) ?? 10) * p;
};

/** Trabalhado vs. programado por barra: o programado é a faixa clara; o que passa dele vai por cima, noutra cor. */
export function PersonStatsChart({ buckets }: { buckets: StatsBucket[] }) {
  const { t } = useI18n();
  const [hover, setHover] = useState<number | null>(null);
  if (!buckets.length) return <p className="py-10 text-center text-sm text-ink-secondary">{t("stats.chart.empty")}</p>;
  const max = Math.max(3600, ...buckets.map((b) => Math.max(b.worked, b.theoretical)));
  // Linhas de grelha em horas redondas (1, 2, 5, 10, 20, 50… horas), 3 a 4 linhas.
  const step = niceHours(max / 3) * 3600;
  const top = step * Math.ceil(max / step);
  const pct = (s: number) => `${(s / top) * 100}%`;
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
  const n = buckets.length;
  const h = hover !== null ? buckets[hover]! : null;

  return (
    <div>
      <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-secondary" aria-label={t("stats.chart")}>
        {[
          [WORKED, t("stats.chart.worked")],
          [PLANNED, t("stats.chart.theoretical")],
          [EXCESS, t("stats.chart.excess")],
        ].map(([c, l]) => (
          <li key={l} className="flex items-center gap-1.5">
            <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full border border-black/5" style={{ backgroundColor: c }} />
            {l}
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <div className="relative w-8 shrink-0 text-right text-[11px] tabular-nums text-ink-muted" style={{ height: H }} aria-hidden="true">
          {ticks.map((v) => (
            <span key={v} className="absolute right-0 translate-y-1/2" style={{ bottom: pct(v) }}>
              {hoursTick(v)}
            </span>
          ))}
        </div>
        <div className="relative min-w-0 flex-1">
          <div className="relative" style={{ height: H }} onMouseLeave={() => setHover(null)}>
            {ticks.map((v) => (
              <div key={v} aria-hidden="true" className={`absolute inset-x-0 border-t ${v === 0 ? "border-line" : "border-dashed border-line-subtle"}`} style={{ bottom: pct(v) }} />
            ))}
            <ul className="absolute inset-0 flex items-end" aria-label={t("stats.chart")}>
              {buckets.map((b, i) => {
                const within = Math.min(b.worked, b.theoretical);
                const over = Math.max(0, b.worked - b.theoretical);
                return (
                  <li
                    key={b.key}
                    tabIndex={0}
                    aria-label={`${b.label}: ${t("stats.chart.worked")} ${formatDuration(b.worked)}, ${t("stats.chart.theoretical")} ${formatDuration(b.theoretical)}`}
                    onMouseEnter={() => setHover(i)}
                    onFocus={() => setHover(i)}
                    onBlur={() => setHover(null)}
                    className="relative flex h-full flex-1 cursor-default justify-center outline-none focus-visible:bg-surface-soft/60"
                    style={{ opacity: hover === null || hover === i ? 1 : 0.55 }}
                  >
                    {/* Barra fina (até 24px), ponta arredondada e base reta; programado atrás, trabalhado à frente. */}
                    <span className="relative h-full w-[60%] max-w-6">
                      <span className="absolute inset-x-0 bottom-0 rounded-t" style={{ height: pct(b.theoretical), backgroundColor: PLANNED }} />
                      <span className={`absolute inset-x-0 bottom-0 ${over > 0 ? "" : "rounded-t"}`} style={{ height: pct(within), backgroundColor: WORKED }} />
                      {over > 0 && <span className="absolute inset-x-0 rounded-t" style={{ bottom: `calc(${pct(b.theoretical)} + 2px)`, height: pct(over), backgroundColor: EXCESS }} />}
                    </span>
                  </li>
                );
              })}
            </ul>
            {h && hover !== null && (
              <div
                role="tooltip"
                className="pointer-events-none absolute top-0 z-10 w-44 -translate-x-1/2 rounded-xl border border-line bg-surface-card p-2.5 text-xs shadow-pop"
                style={{ left: `clamp(88px, ${((hover + 0.5) / n) * 100}%, calc(100% - 88px))` }}
              >
                <p className="mb-1 font-semibold text-navy-900">{h.label}</p>
                <p className="flex justify-between gap-2 text-ink-secondary">
                  {t("stats.chart.worked")} <span className="tabular-nums text-ink">{formatDuration(h.worked)}</span>
                </p>
                <p className="flex justify-between gap-2 text-ink-secondary">
                  {t("stats.chart.theoretical")} <span className="tabular-nums text-ink">{formatDuration(h.theoretical)}</span>
                </p>
                {(h.missing > 0 || h.late > 0) && (
                  <p className="mt-1 border-t border-line-subtle pt-1 text-ink-secondary">
                    {t("stats.missing")}: {h.missing} · {t("stats.late")}: {h.late}
                  </p>
                )}
              </div>
            )}
          </div>
          <div className="mt-1.5 flex text-[11px] tabular-nums text-ink-muted" aria-hidden="true">
            {buckets.map((b, i) => (
              <span key={b.key} className="flex-1 truncate text-center">
                {/* Com muitas barras, só uma etiqueta em cada três. */}
                {n <= 16 || i % 3 === 0 ? b.label : ""}
              </span>
            ))}
          </div>
        </div>
      </div>
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-xs font-medium text-ink-secondary hover:text-ink">{t("stats.chart.table")}</summary>
        <div className="mt-2 max-h-64 overflow-auto">
          <table className={TABLE}>
            <thead className={THEAD}>
              <tr>
                <th className={TH}>{t("stats.chart.period")}</th>
                <th className={TH}>{t("stats.chart.worked")}</th>
                <th className={TH}>{t("stats.chart.theoretical")}</th>
                <th className={TH}>{t("stats.missing")}</th>
                <th className={TH}>{t("stats.late")}</th>
              </tr>
            </thead>
            <tbody>
              {buckets.map((b) => (
                <tr key={b.key} className={TR}>
                  <td className={TD}>{b.label}</td>
                  <td className={`${TD} tabular-nums`}>{formatDuration(b.worked)}</td>
                  <td className={`${TD} tabular-nums`}>{formatDuration(b.theoretical)}</td>
                  <td className={`${TD} tabular-nums`}>{b.missing}</td>
                  <td className={`${TD} tabular-nums`}>{b.late}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
