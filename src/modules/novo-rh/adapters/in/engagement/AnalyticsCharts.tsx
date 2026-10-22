import { useState } from "react";
import type { Slice } from "../../../domain/services/team-analytics.service.ts";
import { UNKNOWN } from "../../../domain/services/team-analytics.service.ts";
import { CATEGORICAL, NEUTRAL } from "./analytics-palette.ts";

/**
 * Gráficos da Análise da equipa (paleta em `analytics-palette.ts`). Cada
 * gráfico tem legenda com os valores (a cor nunca é a única pista) e valores
 * ao passar o rato ou com o teclado.
 */
const colorOf = (s: Slice, i: number) => (s.key === UNKNOWN || s.key.startsWith("Sem ") || s.key === "Outros" || s.key === "Outras" ? NEUTRAL : CATEGORICAL[i % CATEGORICAL.length]!);
const pct = (v: number, total: number) => (total ? Math.round((v / total) * 100) : 0);

/** Rosca: fatias com um espaço de 2px; ao centro o total ou a fatia em foco. */
export function Donut({ slices, label, unit = "colaboradores" }: { slices: Slice[]; label: string; unit?: string }) {
  const [focus, setFocus] = useState<number | null>(null);
  const total = slices.reduce((s, x) => s + x.value, 0);
  if (!total) return <p className="py-8 text-center text-sm text-ink-secondary">Sem dados.</p>;
  const R = 70;
  const W = 24;
  const C = 2 * Math.PI * R;
  // Início de cada fatia (calculado antes de desenhar).
  const starts = slices.map((_, i) => slices.slice(0, i).reduce((s, x) => s + (x.value / total) * C, 0));
  const f = focus !== null ? slices[focus] : null;
  return (
    <div className="flex flex-wrap items-center gap-6">
      <svg viewBox="0 0 180 180" className="h-44 w-44 shrink-0" role="img" aria-label={`${label}: ${slices.map((s) => `${s.label} ${s.value}`).join(", ")}`}>
        <g transform="rotate(-90 90 90)">
          {slices.map((s, i) => {
            const len = (s.value / total) * C;
            const gap = slices.length > 1 ? Math.min(2, len / 2) : 0;
            return (
              <circle
                key={s.key}
                cx="90"
                cy="90"
                r={R}
                fill="none"
                stroke={colorOf(s, i)}
                strokeWidth={focus === i ? W + 4 : W}
                strokeDasharray={`${Math.max(0, len - gap)} ${C}`}
                strokeDashoffset={-starts[i]!}
                onMouseEnter={() => setFocus(i)}
                onMouseLeave={() => setFocus(null)}
              />
            );
          })}
        </g>
        <text x="90" y="86" textAnchor="middle" className="fill-navy-900" style={{ fontSize: 26, fontWeight: 600 }}>
          {f ? f.value : total}
        </text>
        <text x="90" y="106" textAnchor="middle" className="fill-ink-secondary" style={{ fontSize: 11 }}>
          {f ? `${pct(f.value, total)}%` : unit}
        </text>
      </svg>
      <ul className="min-w-40 max-w-sm flex-1 space-y-1.5 text-sm">
        {slices.map((s, i) => (
          <li key={s.key}>
            <button
              type="button"
              onMouseEnter={() => setFocus(i)}
              onMouseLeave={() => setFocus(null)}
              onFocus={() => setFocus(i)}
              onBlur={() => setFocus(null)}
              className={`flex w-full items-center gap-2 rounded-lg px-1.5 py-0.5 text-left ${focus === i ? "bg-surface-soft" : ""}`}
            >
              <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: colorOf(s, i) }} />
              <span className="min-w-0 flex-1 truncate text-ink-secondary">{s.label}</span>
              <span className="tabular-nums text-ink">{s.value}</span>
              <span className="w-10 text-right text-xs tabular-nums text-ink-muted">{pct(s.value, total)}%</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Barras horizontais com o valor no fim (nacionalidade, gerações, antiguidade). */
export function HBars({ slices, color = CATEGORICAL[2]! }: { slices: Slice[]; color?: string }) {
  const max = Math.max(1, ...slices.map((s) => s.value));
  if (!slices.length) return <p className="py-8 text-center text-sm text-ink-secondary">Sem dados.</p>;
  return (
    <ul className="space-y-2.5">
      {slices.map((s) => (
        <li key={s.key} className="grid grid-cols-[minmax(7rem,11rem)_1fr_2.5rem] items-center gap-3 text-sm" title={`${s.label}: ${s.value}`}>
          <span className="truncate text-ink-secondary">{s.label}</span>
          <span className="h-5 overflow-hidden rounded-r bg-surface-soft">
            <span className="block h-full rounded-r" style={{ width: `${(s.value / max) * 100}%`, backgroundColor: s.key === UNKNOWN || s.key === "Outras" ? NEUTRAL : color }} />
          </span>
          <span className="text-right font-semibold tabular-nums text-ink">{s.value}</span>
        </li>
      ))}
    </ul>
  );
}

/** Colunas por mês (efetivo, idade média): uma série, valor ao passar o rato. */
export function Columns({ points, label, color = CATEGORICAL[1]! }: { points: { key: string; label: string; value: number | null }[]; label: string; color?: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...points.map((p) => p.value ?? 0));
  const h = hover !== null ? points[hover]! : null;
  return (
    <div className="relative">
      <ul className="flex h-36 items-end gap-1.5 border-b border-line" aria-label={label} onMouseLeave={() => setHover(null)}>
        {points.map((p, i) => (
          <li
            key={p.key}
            tabIndex={0}
            aria-label={`${p.label}: ${p.value ?? "—"}`}
            onMouseEnter={() => setHover(i)}
            onFocus={() => setHover(i)}
            onBlur={() => setHover(null)}
            className="flex h-full flex-1 items-end justify-center outline-none focus-visible:bg-surface-soft/60"
          >
            <span className="w-[60%] max-w-6 rounded-t" style={{ height: `${((p.value ?? 0) / max) * 100}%`, backgroundColor: color, opacity: hover === null || hover === i ? 1 : 0.55 }} />
          </li>
        ))}
      </ul>
      <div className="mt-1 flex text-[11px] text-ink-muted" aria-hidden="true">
        {points.map((p, i) => (
          <span key={p.key} className="flex-1 text-center">
            {i % 2 === points.length % 2 ? "" : p.label}
          </span>
        ))}
      </div>
      {h && (
        <div role="tooltip" className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full rounded-xl border border-line bg-surface-card px-2.5 py-1.5 text-xs shadow-pop" style={{ left: `${((hover! + 0.5) / points.length) * 100}%` }}>
          <span className="text-ink-secondary">{h.label}: </span>
          <span className="font-semibold tabular-nums text-navy-900">{h.value ?? "—"}</span>
        </div>
      )}
    </div>
  );
}
