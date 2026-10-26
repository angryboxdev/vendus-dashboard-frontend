import type { ReactNode } from "react";
import { NUMERIC, SURFACE } from "../../../../components/ui/index.ts";
import type { MonthStatus } from "../../domain/entities/bank-statement.ts";

export type KpiTone = "green" | "red" | "navy" | "violet" | "blue" | "amber" | "neutral";

const TONE_BOX: Record<KpiTone, string> = {
  green: "bg-emerald-50 text-emerald-600",
  red: "bg-red-50 text-red-600",
  navy: "bg-surface-soft text-navy-900",
  violet: "bg-violet-50 text-violet-600",
  blue: "bg-sky-50 text-sky-600",
  amber: "bg-amber-50 text-amber-600",
  neutral: "bg-surface-soft text-ink-secondary",
};

/** Cartão de indicador: ícone num quadrado de cor, rótulo e valor (mockups Bancos V2). */
export function KpiCard({ icon, tone, label, value, valueClass = "text-navy-900", hint, compact = false }: { icon: ReactNode; tone: KpiTone; label: string; value: ReactNode; valueClass?: string; hint?: ReactNode; compact?: boolean }) {
  return (
    <div className={`${SURFACE} flex items-center ${compact ? "gap-3 px-3.5 py-3" : "gap-4 px-5 py-4"}`}>
      <span className={`flex shrink-0 items-center justify-center rounded-xl ${compact ? "h-9 w-9" : "h-12 w-12"} ${TONE_BOX[tone]}`}>{icon}</span>
      <div className="min-w-0">
        <p className={`text-ink-secondary ${compact ? "text-xs leading-tight" : "truncate text-[13px]"}`}>{label}</p>
        <p className={`mt-0.5 whitespace-nowrap font-bold ${compact ? "text-lg" : "truncate text-xl"} ${NUMERIC} ${valueClass}`}>{value}</p>
        {hint && <p className="truncate text-xs text-ink-muted">{hint}</p>}
      </div>
    </div>
  );
}

const STATUS: Record<MonthStatus, { label: string; chip: string; bar: string }> = {
  no_statement: { label: "Sem extrato", chip: "bg-surface-soft text-ink-secondary", bar: "bg-ink-muted" },
  imported: { label: "Importado", chip: "bg-sky-50 text-sky-700", bar: "bg-sky-500" },
  partial: { label: "Parcial", chip: "bg-amber-50 text-amber-700", bar: "bg-amber-500" },
  reconciled: { label: "Conciliado", chip: "bg-emerald-50 text-emerald-700", bar: "bg-emerald-500" },
};

export function MonthStatusPill({ status }: { status: MonthStatus }) {
  return <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS[status].chip}`}>{STATUS[status].label}</span>;
}

/** Barra de conciliação com a cor do estado do mês; só existe com percentagem real. */
export function ReconciliationBar({ status, percent }: { status: MonthStatus; percent: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-soft" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
        <span className={`block h-full rounded-full ${STATUS[status].bar}`} style={{ width: `${Math.max(percent, percent > 0 ? 3 : 0)}%` }} />
      </span>
      <span className={`shrink-0 text-xs text-ink-secondary ${NUMERIC}`}>{percent}% conciliado</span>
    </div>
  );
}
