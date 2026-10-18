import { useQuery } from "@tanstack/react-query";
import { useInvoicesModule } from "../../invoices.module.tsx";
import type { PayablesSummaryParams } from "../../domain/entities/invoice.ts";
import { formatMoney as money, summaryNotes } from "../../domain/services/payables-summary.ts";

/**
 * «Total a pagar | Em atraso» (F2 v1.2 §2.3) na barra de filtros, sem cards.
 * O servidor agrega o saldo em aberto (total − pagamentos conciliados) com os
 * mesmos filtros da lista (pesquisa, mês, fornecedor); atraso = vencimento
 * antes de hoje no fuso da organização.
 */
export function PayablesSummaryBar({ params }: { params: PayablesSummaryParams }) {
  const { api } = useInvoicesModule();
  const { data, isError } = useQuery({
    queryKey: ["invoices", "payables-summary", params],
    queryFn: () => api.getPayablesSummary(params),
    staleTime: 30_000,
  });

  if (isError) return <span className="text-xs text-stone-400">Total a pagar indisponível</span>;
  if (!data) return <span className="text-xs text-stone-400" aria-busy="true">Total a pagar…</span>;

  const notes = summaryNotes(data);
  return (
    <div
      className="flex items-center gap-2 whitespace-nowrap text-sm"
      title={notes.length ? notes.join("\n") : undefined}
      data-testid="payables-summary"
    >
      <span className="text-stone-500">
        Total a pagar <span className="font-semibold tabular-nums text-stone-800">{money(data.totalOpenCents, data.currency)}</span>
      </span>
      <span className="text-stone-300">|</span>
      <span className={data.overdueCents > 0 ? "text-red-600" : "text-stone-500"}>
        Em atraso <span className="font-semibold tabular-nums">{money(data.overdueCents, data.currency)}</span>
      </span>
      {notes.length > 0 && <span className="text-xs text-amber-600" aria-label={notes.join(". ")}>ⓘ</span>}
    </div>
  );
}
