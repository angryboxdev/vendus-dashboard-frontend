import { Link } from "react-router-dom";
import { SECTION_TITLE } from "../../../../components/ui/index.ts";
import type { CashFlowToHandle } from "../../domain/entities/cash-flow.ts";
import { euros } from "./cash-flow-format.ts";

const BOX = "flex items-center justify-between gap-3 rounded-xl border border-line px-4 py-3 transition-colors duration-150 hover:bg-surface-soft";

/** «Para tratar»: contas a pagar em aberto (e em atraso) e faturas por rever, com atalho para cada ecrã. */
export function ToHandleCard({ toHandle }: { toHandle: CashFlowToHandle }) {
  const { payables, invoicesToReview } = toHandle;
  return (
    <section aria-labelledby="cash-flow-to-handle">
      <h2 id="cash-flow-to-handle" className={SECTION_TITLE}>
        Para tratar
      </h2>
      <div className="mt-3 space-y-2">
        <Link to="/financial/payable-entries" className={BOX}>
          <span className="text-sm text-ink">A pagar</span>
          <span className="text-right">
            <span className="block text-base font-semibold tabular-nums text-navy-900">{euros(payables.dueCents)}</span>
            {payables.overdueCents > 0 && (
              <span className="block text-xs tabular-nums text-rose-600">{euros(payables.overdueCents)} em atraso</span>
            )}
          </span>
        </Link>
        {invoicesToReview > 0 && (
          <Link to="/financial/invoices" className={BOX}>
            <span>
              <span className="block text-sm text-ink">
                {invoicesToReview} {invoicesToReview === 1 ? "documento por arrumar" : "documentos por arrumar"}
              </span>
              <span className="block text-xs text-ink-secondary">
                {invoicesToReview} {invoicesToReview === 1 ? "fatura por rever" : "faturas por rever"}
              </span>
            </span>
            <span className="text-xs font-medium text-brand-600">Rever</span>
          </Link>
        )}
      </div>
    </section>
  );
}
