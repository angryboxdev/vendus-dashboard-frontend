import { useState } from "react";

export interface WeeklyChartPoint {
  key: string;
  /** Rótulo curto do eixo («W41»). */
  label: string;
  value: number | null;
  /** «solid» = valor medido nesta semana; «dashed» = referência (transportado/incompleto); «none» = sem valor. */
  kind: "solid" | "dashed" | "none";
  tooltip: string;
}

const W = 640;
const H = 160;
const PAD = { top: 12, right: 12, bottom: 22, left: 48 };

/**
 * Linha semanal de uma só série (uma cor, sem legenda — o título diz o que é): marcador cheio nas
 * semanas medidas, troço tracejado nas semanas de referência, tooltip ao passar o rato.
 */
export function WeeklyLineChart({ points, ariaLabel, onSelect }: { points: WeeklyChartPoint[]; ariaLabel: string; onSelect?: (key: string) => void }) {
  const [hover, setHover] = useState<number | null>(null);
  const values = points.map((p) => p.value).filter((v): v is number => v !== null);
  if (values.length === 0) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || max * 0.1 || 1;
  const lo = Math.max(0, min - span * 0.25);
  const hi = max + span * 0.25;
  const n = points.length;
  const step = (W - PAD.left - PAD.right) / Math.max(1, n - 1);
  const x = (i: number) => PAD.left + (n === 1 ? 0 : i * step);
  const y = (v: number) => PAD.top + (1 - (v - lo) / (hi - lo)) * (H - PAD.top - PAD.bottom);
  const ticks = [lo, (lo + hi) / 2, hi];
  const segments = points.slice(1).flatMap((p, k) => {
    const a = points[k]!;
    if (a.value === null || p.value === null) return [];
    return [{ key: p.key, x1: x(k), y1: y(a.value), x2: x(k + 1), y2: y(p.value), dashed: p.kind !== "solid" }];
  });

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full text-brand-600" role="img" aria-label={ariaLabel}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} className="stroke-line" strokeWidth={1} />
            <text x={PAD.left - 6} y={y(t) + 3} textAnchor="end" className="fill-ink-muted" fontSize={10}>
              {t.toLocaleString("pt-PT", { maximumFractionDigits: 2 })}
            </text>
          </g>
        ))}
        {points.map((p, i) =>
          i % 4 === (n - 1) % 4 ? (
            <text key={`l-${p.key}`} x={x(i)} y={H - 6} textAnchor="middle" className="fill-ink-muted" fontSize={10}>
              {p.label}
            </text>
          ) : null,
        )}
        {segments.map((s) => (
          <line key={s.key} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeDasharray={s.dashed ? "4 4" : undefined} opacity={s.dashed ? 0.5 : 1} />
        ))}
        {points.map((p, i) =>
          p.value === null || p.kind !== "solid" ? null : <circle key={`m-${p.key}`} cx={x(i)} cy={y(p.value)} r={4} fill="currentColor" stroke="white" strokeWidth={2} />,
        )}
        {hover !== null && points[hover]!.value !== null && <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={H - PAD.bottom} className="stroke-ink-muted" strokeWidth={1} />}
        {points.map((p, i) => (
          <rect
            key={`h-${p.key}`}
            x={x(i) - step / 2}
            y={0}
            width={step}
            height={H}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            onClick={() => onSelect?.(p.key)}
          />
        ))}
      </svg>
      {hover !== null && (
        <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 rounded-md border border-line bg-surface-card px-2 py-1 text-[11px] text-ink shadow-card">
          {points[hover]!.tooltip}
        </div>
      )}
    </div>
  );
}
