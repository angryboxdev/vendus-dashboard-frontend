import { RISK_LEVEL_LABELS, type RiskLevel } from "../../domain/entities/stock-planning.ts";

const RISK_STYLES: Record<RiskLevel, { cls: string; dot: string }> = {
  critico: { cls: "bg-red-50 text-red-600", dot: "bg-red-500" },
  atencao: { cls: "bg-amber-50 text-amber-700", dot: "bg-amber-500" },
  excesso: { cls: "bg-sky-50 text-sky-700", dot: "bg-sky-500" },
  ok: { cls: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" },
};

export function RiskBadge({ risk }: { risk: RiskLevel }) {
  const style = RISK_STYLES[risk];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${style.cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
      {RISK_LEVEL_LABELS[risk]}
    </span>
  );
}
