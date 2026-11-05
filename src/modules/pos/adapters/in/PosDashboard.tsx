import { PAYMENT_LABELS, STOCK_MOVE_LABELS, formatEuros, type DaySummary, type PaymentMethod, type StockDay, type StockMove } from "../../domain/entities/pos.ts";
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

const hour = (iso: string) => new Date(iso).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "0");

function MovesTable({ moves, alerts = false }: { moves: StockMove[]; alerts?: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className={`text-xs uppercase ${POS.mutedText}`}>
          <tr>
            <th className="py-2 pr-2 font-semibold">Hora</th>
            <th className="py-2 pr-2 font-semibold">Artigo</th>
            <th className="py-2 pr-2 font-semibold">{alerts ? "Stock antes" : "Movimento"}</th>
            <th className="py-2 pr-2 text-right font-semibold">{alerts ? "Vendido" : "Qtd."}</th>
            <th className="py-2 pr-2 text-right font-semibold">Stock depois</th>
            <th className="py-2 pr-2 font-semibold">Documento</th>
            <th className="py-2 font-semibold">Quem</th>
          </tr>
        </thead>
        <tbody>
          {moves.map((m) => (
            <tr key={m.id} className={`border-t ${POS.border}`}>
              <td className={`py-2 pr-2 ${POS.num}`}>{hour(m.createdAt)}</td>
              <td className="py-2 pr-2 font-medium">{m.productName}</td>
              <td className={`py-2 pr-2 ${POS.num}`}>{alerts ? m.stockBefore : STOCK_MOVE_LABELS[m.kind]}</td>
              <td className={`py-2 pr-2 text-right font-semibold ${POS.num}`}>{alerts ? -m.qty : signed(m.qty)}</td>
              <td className={`py-2 pr-2 text-right ${POS.num}`}>
                <span className={m.stockAfter < 0 ? `${POS.red} rounded-full px-2 font-semibold` : ""}>{m.stockAfter}</span>
              </td>
              <td className="py-2 pr-2">{m.documentNumber ?? m.note ?? "—"}</td>
              <td className="py-2">{m.actorName ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Painel do dia: vendas líquidas, notas de crédito, ticket médio, fecho por forma de pagamento, alertas e movimentos de stock. */
export function PosDashboard({ summary, stock }: { summary: DaySummary | null; stock: StockDay | null }) {
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
      <section className={`${POS.card} ${POS.border} rounded-2xl border p-4`} aria-label="Alertas de stock">
        <h3 className="mb-1 font-semibold">
          Alertas de stock {stock && stock.alerts.length > 0 && <span className={`${POS.red} ml-1 rounded-full px-2 text-sm ${POS.num}`}>{stock.alerts.length}</span>}
        </h3>
        <p className={`mb-2 text-xs ${POS.mutedText}`}>Vendas feitas sem stock suficiente («Vender na mesma»).</p>
        {!stock ? <p className={`text-sm ${POS.mutedText}`}>A carregar…</p> : stock.alerts.length === 0 ? <p className={`text-sm ${POS.mutedText}`}>Sem alertas hoje.</p> : <MovesTable moves={stock.alerts} alerts />}
      </section>
      <section className={`${POS.card} ${POS.border} rounded-2xl border p-4`} aria-label="Movimentos de stock">
        <h3 className="mb-2 font-semibold">Movimentos de stock</h3>
        {!stock ? <p className={`text-sm ${POS.mutedText}`}>A carregar…</p> : stock.moves.length === 0 ? <p className={`text-sm ${POS.mutedText}`}>Sem movimentos hoje.</p> : <MovesTable moves={stock.moves} />}
      </section>
    </div>
  );
}
