import { useMutation, useQueryClient } from "@tanstack/react-query";
import { usePayableRecurrencesModule } from "../../../payable-recurrences/payable-recurrences.module.tsx";
import {
  type InvoiceRecurrenceStatusDTO,
  OCCURRENCE_STATUS_LABELS,
  formatDeviation,
  formatPeriod,
} from "../../../payable-recurrences/domain/entities/recurrence.ts";

function fromCents(n: number): string {
  return (n / 100).toLocaleString("pt-PT", { style: "currency", currency: "EUR" });
}

interface Props {
  invoiceId: string;
  /** A fatura faz parte de um documento de pagamento com várias faturas (ex.: águas + resíduos). */
  inPaymentGroup?: boolean;
  status: InvoiceRecurrenceStatusDTO;
  onOpenRecurrence: (recurrenceId: string) => void;
}

/**
 * Fatura ↔ recorrência no detalhe da fatura: a associação (automática ou à mão),
 * com aviso quando o valor real se afasta do previsto e «Desassociar»; sem ela,
 * as recorrências sugeridas com «Associar».
 */
export function InvoiceRecurrenceCard({ invoiceId, inPaymentGroup = false, status, onOpenRecurrence }: Props) {
  const { api } = usePayableRecurrencesModule();
  const qc = useQueryClient();

  function invalidate() {
    void qc.invalidateQueries({ queryKey: ["invoice-recurrence-status", invoiceId] });
    void qc.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith("payable-recurrences") });
  }

  const linkMutation = useMutation({
    mutationFn: (c: { recurrenceId: string; period: string }) => api.linkInvoiceToRecurrence({ invoiceId, ...c }),
    onSuccess: invalidate,
  });
  const unlinkMutation = useMutation({
    mutationFn: (occId: string) => api.unlinkInvoiceFromOccurrence(occId),
    onSuccess: invalidate,
  });
  const error = (linkMutation.error ?? unlinkMutation.error) as Error | null;

  if (status.linked) {
    const { occurrence: occ, recurrenceName } = status.linked;
    const rows = [
      { label: "Nome", value: recurrenceName },
      { label: "Período", value: formatPeriod(occ.period) },
      { label: "Estado", value: OCCURRENCE_STATUS_LABELS[occ.status] },
      { label: "Previsto", value: fromCents(occ.estimatedAmountCents) },
      {
        label: inPaymentGroup ? "Real (documento de pagamento)" : "Real (fatura)",
        value: occ.realAmountCents != null ? fromCents(occ.realAmountCents) : "—",
      },
    ];
    return (
      <div className="rounded-lg border border-stone-200 p-4 space-y-2">
        <p className="text-xs font-semibold text-stone-500">Recorrência associada</p>
        {inPaymentGroup && (
          <p className="text-[11px] text-stone-400">
            Esta fatura faz parte de um documento de pagamento com outras faturas — a recorrência conta o documento todo (um só pagamento).
          </p>
        )}
        <div className="divide-y divide-stone-100">
          {rows.map(({ label, value }) => (
            <div key={label} className="flex justify-between py-2 first:pt-0">
              <dt className="text-xs text-stone-400">{label}</dt>
              <dd className="text-xs font-medium text-stone-700">{value}</dd>
            </div>
          ))}
        </div>
        {occ.invoiceDeviationWarning && occ.invoiceDeviationPercent != null && (
          <p className="rounded-md bg-amber-50 px-2.5 py-1.5 text-xs text-amber-700">
            Valor {formatDeviation(occ.invoiceDeviationPercent)} face ao previsto — confirme se está correto.
          </p>
        )}
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={() => onOpenRecurrence(occ.recurrenceId)}
            className="text-xs font-medium text-[#ED5C32] hover:underline"
          >
            Ver recorrência →
          </button>
          {occ.status === "invoice_linked" && (
            <button
              onClick={() => {
                if (confirm("Desassociar esta fatura da recorrência? A ocorrência volta ao valor previsto.")) {
                  unlinkMutation.mutate(occ.id);
                }
              }}
              disabled={unlinkMutation.isPending}
              className="rounded px-2 py-1 text-xs text-stone-500 hover:bg-stone-100 disabled:opacity-50"
            >
              {unlinkMutation.isPending ? "A desassociar…" : "Desassociar"}
            </button>
          )}
        </div>
        {error && <p className="text-xs text-red-500">{error.message}</p>}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[#F5C992]/60 bg-[#FDF8F5] p-4 space-y-2">
      <p className="text-xs font-semibold text-stone-600">
        {status.candidates.length === 1 ? "Recorrência sugerida" : "Recorrências sugeridas"}
      </p>
      <p className="text-[11px] text-stone-400">
        {status.candidates.length > 1
          ? "Há mais de uma recorrência deste fornecedor — escolha a que corresponde a esta fatura."
          : "Associe para o previsto passar a real."}
      </p>
      <ul className="space-y-1.5">
        {status.candidates.map((c) => {
          const busy =
            linkMutation.isPending &&
            linkMutation.variables?.recurrenceId === c.recurrenceId &&
            linkMutation.variables?.period === c.period;
          return (
            <li
              key={`${c.recurrenceId}:${c.period}`}
              className="flex items-center justify-between gap-2 rounded-md bg-white px-2.5 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-stone-700">{c.recurrenceName}</p>
                <p className="text-[11px] text-stone-400">
                  <span className="capitalize">{formatPeriod(c.period)}</span> · previsto {fromCents(c.estimatedAmountCents)}
                  {c.deviationPercent != null && c.deviationPercent !== 0 && <> · {formatDeviation(c.deviationPercent)}</>}
                </p>
              </div>
              <button
                onClick={() => linkMutation.mutate({ recurrenceId: c.recurrenceId, period: c.period })}
                disabled={linkMutation.isPending}
                className="shrink-0 rounded-md bg-gradient-to-r from-[#ED5C32] to-[#EF8935] px-2.5 py-1 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                {busy ? "A associar…" : "Associar"}
              </button>
            </li>
          );
        })}
      </ul>
      {error && <p className="text-xs text-red-500">{error.message}</p>}
    </div>
  );
}
