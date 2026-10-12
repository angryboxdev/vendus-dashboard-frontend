import type { ReactNode } from "react";

/** Cor operacional do turno (pastéis próprios; não substituem a paleta da marca). */
export type ShiftTone = "morning" | "afternoon" | "night" | "split" | "other";

const TONE: Record<ShiftTone, { fill: string; soft: string; line: string; ink: string }> = {
  morning: { fill: "bg-shift-morning-bg", soft: "bg-shift-morning-bg/25", line: "border-shift-morning-line", ink: "text-shift-morning-ink" },
  afternoon: { fill: "bg-shift-afternoon-bg", soft: "bg-shift-afternoon-bg/25", line: "border-shift-afternoon-line", ink: "text-shift-afternoon-ink" },
  night: { fill: "bg-shift-night-bg", soft: "bg-shift-night-bg/25", line: "border-shift-night-line", ink: "text-shift-night-ink" },
  split: { fill: "bg-shift-split-bg", soft: "bg-shift-split-bg/25", line: "border-shift-split-line", ink: "text-shift-split-ink" },
  other: { fill: "bg-shift-other-bg", soft: "bg-shift-other-bg/25", line: "border-shift-other-line", ink: "text-shift-other-ink" },
};

/** Chip do tipo de turno ("Man", "Not"…), com o pastel do tipo. */
export function ShiftTypeChip({ tone, children }: { tone: ShiftTone; children: ReactNode }) {
  const t = TONE[tone];
  return <span className={`inline-flex h-8 min-w-[44px] items-center justify-center rounded-lg px-2 text-xs font-medium ${t.fill} ${t.ink}`}>{children}</span>;
}

/**
 * O mesmo cartão para todos os turnos. Publicado = pastel preenchido
 * (consolidado); rascunho = quase branco, borda tracejada na cor do tipo e a
 * palavra "Rascunho" para leitores de ecrã (o estado nunca é só cor).
 */
export function ShiftCard({
  tone,
  title,
  times,
  hours,
  status = "published",
  onClick,
  tooltip,
  className = "",
  style,
  indicator,
}: {
  tone: ShiftTone;
  title: ReactNode;
  /** Um ou dois períodos ("09:00 - 14:00"). */
  times: string[];
  /** "6h" — só mostrado quando há um período (no partido não cabe). */
  hours?: string;
  status?: "published" | "draft";
  onClick?: () => void;
  tooltip?: string;
  className?: string;
  style?: React.CSSProperties;
  /** Ponto de estado (ex.: presença conferida) com o texto para leitores de ecrã. */
  indicator?: { className: string; label: string };
}) {
  const t = TONE[tone];
  const draft = status === "draft";
  const body = (
    <>
      <span className="flex items-center justify-between gap-1.5">
        <span className="block truncate text-[12px] font-semibold leading-4 text-ink">{title}</span>
        {indicator && (
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${indicator.className}`} title={indicator.label}>
            <span className="sr-only">{indicator.label}</span>
          </span>
        )}
      </span>
      {times.map((time, i) => (
        <span key={i} className="mt-0.5 flex items-center justify-between gap-1 whitespace-nowrap text-[10.5px] leading-4 text-ink-secondary tabular-nums">
          <span className="truncate">{time}</span>
          {times.length === 1 && hours && <span className="shrink-0">{hours}</span>}
        </span>
      ))}
      {draft && <span className="sr-only"> (rascunho)</span>}
    </>
  );
  const cls = `block w-full rounded-lg px-1.5 py-2 text-left transition duration-150 ${
    draft ? `border border-dashed ${t.line} ${t.soft}` : `border border-transparent ${t.fill}`
  } ${onClick ? "hover:-translate-y-px hover:shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40" : ""} ${className}`;
  return onClick ? (
    <button type="button" onClick={onClick} title={tooltip} className={cls} style={style}>
      {body}
    </button>
  ) : (
    <div title={tooltip} className={cls} style={style}>
      {body}
    </div>
  );
}
