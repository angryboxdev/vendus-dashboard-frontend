import { CONFIDENCE_LEVEL_LABELS, type ConfidenceLevel } from "../../domain/entities/stock-planning.ts";

const CONFIDENCE_STYLES: Record<ConfidenceLevel, { cls: string; dot: string }> = {
  alta: { cls: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" },
  media: { cls: "bg-amber-50 text-amber-700", dot: "bg-amber-500" },
  baixa: { cls: "bg-rose-50 text-rose-600", dot: "bg-rose-500" },
};

export function ConfidenceBadge({ confidence }: { confidence: ConfidenceLevel }) {
  const style = CONFIDENCE_STYLES[confidence];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${style.cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
      Confiança: {CONFIDENCE_LEVEL_LABELS[confidence]}
    </span>
  );
}

const SEVERITY_STYLES: Record<string, { cls: string; dot: string }> = {
  baixa: { cls: "bg-stone-100 text-stone-600", dot: "bg-stone-400" },
  media: { cls: "bg-amber-50 text-amber-700", dot: "bg-amber-500" },
  alta: { cls: "bg-orange-50 text-orange-700", dot: "bg-orange-500" },
  critica: { cls: "bg-red-50 text-red-600", dot: "bg-red-500" },
};

export function SeverityBadge({ severity, label }: { severity: string; label: string }) {
  const style = SEVERITY_STYLES[severity] ?? { cls: "bg-stone-100 text-stone-600", dot: "bg-stone-400" };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${style.cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
      {label}
    </span>
  );
}

const STATE_STYLES: Record<string, { cls: string; dot: string }> = {
  active: { cls: "bg-red-50 text-red-600", dot: "bg-red-500" },
  acknowledged: { cls: "bg-sky-50 text-sky-700", dot: "bg-sky-500" },
  silenced: { cls: "bg-stone-100 text-stone-500", dot: "bg-stone-400" },
  resolved: { cls: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" },
};

export function StateBadge({ state, label }: { state: string; label: string }) {
  const style = STATE_STYLES[state] ?? { cls: "bg-stone-100 text-stone-600", dot: "bg-stone-400" };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${style.cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
      {label}
    </span>
  );
}
