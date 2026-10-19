import { memo, useEffect, useRef, useState } from "react";
import { TEAM_CATEGORIES, type TeamCategory, type TeamChart, type TeamCounts } from "../../../domain/entities/dashboard.ts";
import { donutSegments, TEAM_LABEL, teamShare } from "../../../domain/services/dashboard.service.ts";

/** Cores semânticas das categorias (estados, não identidade da marca). */
const TEAM_COLOR: Record<TeamCategory, { stroke: string; bg: string; fill: string }> = {
  working: { stroke: "stroke-emerald-500", bg: "bg-emerald-500", fill: "fill-emerald-500" },
  remote: { stroke: "stroke-sky-400", bg: "bg-sky-400", fill: "fill-sky-400" },
  break: { stroke: "stroke-amber-400", bg: "bg-amber-400", fill: "fill-amber-400" },
  finished: { stroke: "stroke-slate-400", bg: "bg-slate-400", fill: "fill-slate-400" },
  not_started: { stroke: "stroke-slate-200", bg: "bg-slate-200", fill: "fill-slate-200" },
  vacation: { stroke: "stroke-indigo-300", bg: "bg-indigo-300", fill: "fill-indigo-300" },
  absent: { stroke: "stroke-red-400", bg: "bg-red-400", fill: "fill-red-400" },
};


const R = 52;
const C = 2 * Math.PI * R;
const reduced = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** «Trabalhando: 5 (42 %)» — a percentagem só existe com total. */
const tip = (team: TeamCounts, c: TeamCategory) => {
  const share = teamShare(team, c);
  return `${TEAM_LABEL[c]}: ${team[c] ?? 0}${share === null ? "" : ` (${share} %)`}`;
};

/**
 * Estado da equipa em rosca (predefinido) ou barras — os dois sobre
 * os mesmos números (categorias mutuamente exclusivas) e com a mesma legenda
 * textual (estado + quantidade); segmento, barra, fatia e legenda chamam a
 * mesma ação. SVG leve, sem biblioteca. A rosca anima uma vez por montagem;
 * com movimento reduzido mostra logo o final. `memo`: só volta a desenhar
 * quando os números ou o formato mudam.
 */
export const TeamStatusDonut = memo(function TeamStatusDonut({ team, onSelect, format = "donut" }: { team: TeamCounts; onSelect: (c: TeamCategory) => void; format?: TeamChart }) {
  const [hover, setHover] = useState<TeamCategory | null>(null);
  const hoverProps = (c: TeamCategory) => ({ onMouseEnter: () => setHover(c), onMouseLeave: () => setHover(null), onFocus: () => setHover(c), onBlur: () => setHover(null) });

  if (format === "bar") return <TeamBars team={team} onSelect={onSelect} hover={hover} hoverProps={hoverProps} />;
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-4">
      <TeamDonut team={team} onSelect={onSelect} hover={hover} setHover={setHover} />
      <ul className="min-w-[180px] flex-1 space-y-0.5">
        {TEAM_CATEGORIES.map((c) => (
          <li key={c}>
            <button
              type="button"
              onClick={() => onSelect(c)}
              {...hoverProps(c)}
              title={tip(team, c)}
              aria-label={`${TEAM_LABEL[c]}: ${team[c] ?? 0}. Ver lista`}
              className={`flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left text-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 ${hover === c ? "bg-surface-soft" : "hover:bg-surface-soft"}`}
            >
              <span aria-hidden="true" className={`h-3 w-3 shrink-0 rounded-full ${TEAM_COLOR[c].bg}`} />
              <span className="flex-1 truncate text-ink">{TEAM_LABEL[c]}</span>
              <span className="font-semibold tabular-nums text-navy-900">{team[c] ?? 0}</span>
              <span aria-hidden="true" className="text-ink-muted">›</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
});

type ChartProps = { team: TeamCounts; onSelect: (c: TeamCategory) => void; hover: TeamCategory | null; setHover: (c: TeamCategory | null) => void };

function TeamDonut({ team, onSelect, hover, setHover }: ChartProps) {
  const segs = donutSegments(team, C);
  const svg = useRef<SVGSVGElement>(null);
  const total = useRef<HTMLSpanElement>(null);
  const animated = useRef(false);

  useEffect(() => {
    if (animated.current || !svg.current || !segs.length) return;
    animated.current = true;
    if (reduced()) return;
    const circles = [...svg.current.querySelectorAll<SVGCircleElement>("circle[data-seg]")];
    circles.forEach((el, i) => {
      const len = el.getAttribute("data-len")!;
      el.animate?.([{ strokeDasharray: `0 ${C}` }, { strokeDasharray: `${len} ${C}` }], { duration: 650, delay: i * 40, easing: "cubic-bezier(.2,.7,.2,1)", fill: "backwards" });
    });
    svg.current.querySelector("g[data-spin]")?.animate?.([{ transform: "rotate(-40deg)" }, { transform: "rotate(0deg)" }], { duration: 750, easing: "cubic-bezier(.2,.7,.2,1)" });
    // Contagem do total escrita no DOM (sem re-render).
    const el = total.current;
    if (!el) return;
    const end = team.total;
    const start = performance.now();
    let frame = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / 700);
      el.textContent = String(Math.round(end * (1 - Math.pow(1 - k, 3))));
      if (k < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [segs.length, team.total]);

  return (
    <div className="relative h-36 w-36 shrink-0">
      <svg ref={svg} viewBox="0 0 140 140" className="h-full w-full -rotate-90" role="img" aria-label={`${team.total} colaboradores`}>
        <circle cx="70" cy="70" r={R} fill="none" className="stroke-surface-soft" strokeWidth="16" />
        <g data-spin="" style={{ transformOrigin: "70px 70px" }}>
          {segs.map((s) => (
            <circle
              key={s.category}
              data-seg={s.category}
              data-len={s.length}
              cx="70"
              cy="70"
              r={R}
              fill="none"
              strokeWidth={hover === s.category ? 19 : 16}
              strokeDasharray={`${s.length} ${C}`}
              strokeDashoffset={s.offset}
              strokeLinecap="butt"
              className={`cursor-pointer transition-[stroke-width,opacity] duration-150 ${TEAM_COLOR[s.category].stroke}`}
              opacity={hover && hover !== s.category ? 0.45 : 1}
              onMouseEnter={() => setHover(s.category)}
              onMouseLeave={() => setHover(null)}
              onClick={() => onSelect(s.category)}
            >
              <title>{tip(team, s.category)}</title>
            </circle>
          ))}
        </g>
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span ref={total} className="text-[26px] font-bold leading-none tabular-nums text-navy-900">
          {team.total}
        </span>
        <span className="mt-1 text-[11px] text-ink-secondary">colaboradores</span>
      </div>
    </div>
  );
}

/** Barras horizontais: cada linha é também a legenda (estado + quantidade), na mesma escala. */
function TeamBars({
  team,
  onSelect,
  hover,
  hoverProps,
}: {
  team: TeamCounts;
  onSelect: (c: TeamCategory) => void;
  hover: TeamCategory | null;
  hoverProps: (c: TeamCategory) => Record<string, () => void>;
}) {
  const max = Math.max(...TEAM_CATEGORIES.map((c) => team[c] ?? 0));
  return (
    <div>
      <p className="mb-2 text-xs text-ink-secondary">
        <strong className="text-base font-bold tabular-nums text-navy-900">{team.total}</strong> colaboradores
      </p>
      <ul className="space-y-0.5">
        {TEAM_CATEGORIES.map((c) => {
          const v = team[c] ?? 0;
          return (
            <li key={c}>
              <button
                type="button"
                onClick={() => onSelect(c)}
                {...hoverProps(c)}
                title={tip(team, c)}
                aria-label={`${TEAM_LABEL[c]}: ${v}. Ver lista`}
                className={`grid w-full grid-cols-[7.5rem_1fr_auto] items-center gap-3 rounded-lg px-2 py-1.5 text-left text-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 ${hover === c ? "bg-surface-soft" : "hover:bg-surface-soft"}`}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span aria-hidden="true" className={`h-3 w-3 shrink-0 rounded-full ${TEAM_COLOR[c].bg}`} />
                  <span className="truncate text-ink">{TEAM_LABEL[c]}</span>
                </span>
                <span aria-hidden="true" className="h-2.5 overflow-hidden rounded-full bg-surface-soft">
                  {v > 0 && <span data-bar={c} className={`block h-full rounded-full ${TEAM_COLOR[c].bg}`} style={{ width: `${Math.max((v / max) * 100, 4)}%` }} />}
                </span>
                <span className="w-6 text-right font-semibold tabular-nums text-navy-900">{v}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
