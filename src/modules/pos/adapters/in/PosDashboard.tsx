import { PAYMENT_LABELS, formatEuros, type DaySummary, type PaymentMethod } from "../../domain/entities/pos.ts";
import { POS } from "./pos-theme.ts";

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className={`${POS.card} ${POS.border} rounded-2xl border p-4`}>
      <p className={`text-sm ${POS.mutedText}`}>{label}</p>
      <p className={`mt-1 text-2xl font-bold ${POS.num}`}>{value}</p>
      {hint && <p className={`text-xs ${POS.mutedText}`}>{hint}</p>}
    </div>
  );
}

/** Painel do dia: vendas líquidas, notas de crédito, ticket médio e fecho por forma de pagamento. */
export function PosDashboard({ summary }: { summary: DaySummary | null }) {
  if (!summary) return <p className={`py-10 text-center ${POS.mutedText}`}>A carregar…</p>;
  return (
    <div className="space-y-4">
      <p className={`text-sm ${POS.mutedText}`}>Hoje, {new Date(`${summary.date}T12:00:00`).toLocaleDateString("pt-PT")} · documentos de teste</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Kpi label="Vendas líquidas" value={formatEuros(summary.netCents)} hint={`${summary.salesCount} venda(s)`} />
        <Kpi label="Notas de crédito" value={formatEuros(summary.refundsCents)} hint={`${summary.refundsCount} nota(s)`} />
        <Kpi label="Ticket médio" value={formatEuros(summary.averageTicketCents)} />
      </div>
      <section className={`${POS.card} ${POS.border} rounded-2xl border p-4`}>
        <h3 className="mb-2 font-semibold">Fecho de caixa por forma de pagamento</h3>
        <dl className="divide-y divide-[#e7d9c6]">
          {(Object.keys(PAYMENT_LABELS) as PaymentMethod[]).map((m) => (
            <div key={m} className="flex justify-between py-2">
              <dt>{PAYMENT_LABELS[m]}</dt>
              <dd className={`font-semibold ${POS.num}`}>{formatEuros(summary.byPayment[m])}</dd>
            </div>
          ))}
        </dl>
        <p className={`mt-2 text-xs ${POS.mutedText}`}>Valores já líquidos de reembolsos.</p>
      </section>
    </div>
  );
}
