import { useEffect, useRef, useState } from "react";
import { TEAM_CATEGORIES, type TeamCategory, type TeamCounts } from "../../../domain/entities/dashboard.ts";
import { donutSegments, TEAM_LABEL } from "../../../domain/services/dashboard.service.ts";

/** Cores semânticas das categorias (estados, não identidade da marca). */
const TEAM_COLOR: Record<TeamCategory, { stroke: string; bg: string }> = {
  working: { stroke: "stroke-emerald-500", bg: "bg-emerald-500" },
  remote: { stroke: "stroke-sky-400", bg: "bg-sky-400" },
  break: { stroke: "stroke-amber-400", bg: "bg-amber-400" },
  finished: { stroke: "stroke-slate-400", bg: "bg-slate-400" },
  not_started: { stroke: "stroke-slate-200", bg: "bg-slate-200" },
  vacation: { stroke: "stroke-indigo-300", bg: "bg-indigo-300" },
  absent: { stroke: "stroke-red-400", bg: "bg-red-400" },
};

const R = 52;
const C = 2 * Math.PI * R;
const reduced = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * Donut em SVG leve (stroke-dasharray), sem biblioteca de gráficos. Anima
 * uma só vez por montagem (preenchimento ~750 ms + contagem do total), sem
 * estado React por frame; com movimento reduzido mostra logo o final.
 * Segmento e legenda chamam a mesma ação.
 */
export function TeamStatusDonut({ team, onSelect }: { team: TeamCounts; onSelect: (c: TeamCategory) => void }) {
  const segs = donutSegments(team, C);
  const [hover, setHover] = useState<TeamCategory | null>(null);
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

  const cats = TEAM_CATEGORIES;
  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:gap-8">
      <div className="relative h-40 w-40 shrink-0">
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
              <title>{`${TEAM_LABEL[s.category]}: ${s.value}`}</title>
            </circle>
          ))}
          </g>
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span ref={total} className="text-[28px] font-bold leading-none tabular-nums text-navy-900">
            {team.total}
          </span>
          <span className="mt-1 text-xs text-ink-secondary">colaboradores</span>
        </div>
      </div>
      <ul className="w-full min-w-0 flex-1 space-y-0.5">
        {cats.map((c) => (
          <li key={c}>
            <button
              type="button"
              onClick={() => onSelect(c)}
              onMouseEnter={() => setHover(c)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(c)}
              onBlur={() => setHover(null)}
              aria-label={`${TEAM_LABEL[c]}: ${team[c] ?? 0}. Ver lista`}
              className={`flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left text-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 ${hover === c ? "bg-surface-soft" : "hover:bg-surface-soft"}`}
            >
              <span aria-hidden="true" className={`h-3 w-3 shrink-0 rounded-full ${TEAM_COLOR[c].bg}`} />
              <span className="flex-1 text-ink">{TEAM_LABEL[c]}</span>
              <span className="font-semibold tabular-nums text-navy-900">{team[c] ?? 0}</span>
              <span aria-hidden="true" className="text-ink-muted">›</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
