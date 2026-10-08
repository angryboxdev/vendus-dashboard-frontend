import type { ReactNode } from "react";

/**
 * Estado com significado (gestão por exceção): verde = aprovado/ativo,
 * âmbar = pendente/atenção, vermelho = erro/crítico, cinza = neutro/cancelado.
 * Não usar para informação que pode ser texto normal.
 */
export type StatusTone = "success" | "warning" | "danger" | "neutral";

const TONE: Record<StatusTone, { chip: string; dot: string }> = {
  success: { chip: "bg-emerald-50 text-emerald-800", dot: "bg-emerald-500" },
  warning: { chip: "bg-amber-50 text-amber-800", dot: "bg-amber-500" },
  danger: { chip: "bg-red-50 text-red-800", dot: "bg-red-500" },
  neutral: { chip: "bg-stone-100 text-stone-600", dot: "bg-stone-400" },
};

export function StatusBadge({ tone, children, dot = true }: { tone: StatusTone; children: ReactNode; dot?: boolean }) {
  const t = TONE[tone];
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${t.chip}`}>
      {dot && <span className={`h-1.5 w-1.5 rounded-full ${t.dot}`} />}
      {children}
    </span>
  );
}
