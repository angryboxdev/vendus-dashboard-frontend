import { Link } from "react-router-dom";
import { SURFACE, SECTION_TITLE } from "../../../../components/ui/index.ts";
import type { CashFlowReport, CashFlowToHandle } from "../../domain/entities/cash-flow.ts";
import { sharePct } from "../../domain/services/cash-flow-view.ts";
import { euros, kindLabel } from "./cash-flow-format.ts";
import { ToHandleCard } from "./ToHandleCard.tsx";

/** Painel lateral: o que há para tratar, quanto das saídas está justificado e de onde vieram as entradas. */
export function CashFlowSidePanel({ report, toHandle }: { report: CashFlowReport; toHandle: CashFlowToHandle | null }) {
  const { justification, inflowKinds, totals } = report;
  const pct = justification.percent;

  return (
    <aside className={`${SURFACE} flex flex-col p-6`}>
      {toHandle && (
        <>
          <ToHandleCard toHandle={toHandle} />
          <div className="my-5 border-t border-line-subtle" />
        </>
      )}
      <h2 className={SECTION_TITLE}>Saídas justificadas</h2>
      {pct === null ? (
        <p className="mt-3 text-sm text-ink-secondary">Sem saídas neste período.</p>
      ) : (
        <>
          <p className="mt-3 text-3xl font-bold tabular-nums text-navy-900">{pct}%</p>
          <div
            className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-soft"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Saídas justificadas"
          >
            <div className={`h-full rounded-full ${pct >= 90 ? "bg-emerald-600" : pct >= 60 ? "bg-amber-500" : "bg-rose-600"}`} style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-2 text-xs text-ink-secondary tabular-nums">
            {euros(justification.justifiedCents)} de {euros(justification.totalCents)} conciliados ou justificados
          </p>
          {justification.pendingCount > 0 && (
            <Link
              to="/financial/bank-statements"
              className="mt-4 flex items-center justify-between rounded-xl border border-line px-4 py-3 text-sm text-navy-900 transition-colors duration-150 hover:bg-surface-soft"
            >
              <span>
                {justification.pendingCount} {justification.pendingCount === 1 ? "saída por tratar" : "saídas por tratar"}
              </span>
              <span className="text-xs font-medium text-brand-600">Conciliar</span>
            </Link>
          )}
        </>
      )}

      <div className="my-5 border-t border-line-subtle" />

      <h2 className={SECTION_TITLE}>Entradas por tipo</h2>
      {inflowKinds.length === 0 ? (
        <p className="mt-3 text-sm text-ink-secondary">Sem entradas neste período.</p>
      ) : (
        <ul className="mt-2 divide-y divide-line-subtle">
          {inflowKinds.map((k) => (
            <li key={k.movementKind} className="flex items-baseline justify-between gap-3 py-2.5">
              <span className="min-w-0 truncate text-sm text-ink">{kindLabel(k.movementKind)}</span>
              <span className="text-right">
                <span className="block text-sm font-semibold tabular-nums text-navy-900">{euros(k.amountCents)}</span>
                <span className="block text-xs tabular-nums text-ink-secondary">{sharePct(k.amountCents, totals.inflowCents)}%</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
