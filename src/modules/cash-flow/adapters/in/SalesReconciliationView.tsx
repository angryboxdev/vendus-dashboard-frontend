import {
  AlertBanner,
  EmptyState,
  PAGE_BG,
  SECTION_TITLE,
  SURFACE,
  Skeleton,
  StatusBadge,
  TABLE,
  TD,
  TH,
  THEAD,
  TR,
} from "../../../../components/ui/index.ts";
import type { SalesReconciliation } from "../../domain/entities/sales-reconciliation.ts";
import { monthName } from "../../domain/services/cash-flow-view.ts";
import { pctLabel, salesRangeLabel, SETTLEMENT_STATUS } from "../../domain/services/sales-reconciliation-view.ts";
import { euros } from "./cash-flow-format.ts";
import { useSalesReconciliation } from "./use-sales-reconciliation.ts";

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <p className="text-xs text-ink-secondary">{label}</p>
      <p className="text-lg font-semibold tabular-nums text-navy-900">{value}</p>
      {hint && <p className="text-xs text-ink-secondary">{hint}</p>}
    </div>
  );
}

/** Cartão do Vendus × créditos TPA: totais, taxa implícita e cada liquidação. */
function CardSection({ report }: { report: SalesReconciliation }) {
  const { card, expectedCardFeePct } = report;
  const feeOff = card.impliedFeePct !== null && Math.abs(card.impliedFeePct - expectedCardFeePct) > report.feeTolerancePct;
  return (
    <section className={`${SURFACE} p-6`} aria-labelledby="rec-card">
      <h2 id="rec-card" className={SECTION_TITLE}>
        Venda restaurante cartão <span className="font-normal text-ink-secondary">· Vendus × créditos TPA</span>
      </h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-4">
        <Kpi label="Vendido em cartão" value={euros(card.soldCents)} hint="Vendus, dias do mês" />
        <Kpi label="Recebido do TPA" value={euros(card.receivedCents)} hint={`Pelo vendido ${euros(card.settledSoldCents)}`} />
        <Kpi label="Diferença" value={euros(card.differenceCents)} hint={`Esperado ${euros(card.expectedFeeCents)}`} />
        <div>
          <p className="text-xs text-ink-secondary">Taxa implícita</p>
          <p className={`text-lg font-semibold tabular-nums ${feeOff ? "text-amber-600" : "text-navy-900"}`}>{pctLabel(card.impliedFeePct)}</p>
          <p className="text-xs text-ink-secondary">Esperada {pctLabel(expectedCardFeePct)}</p>
        </div>
      </div>

      {card.pending && (
        <p className="mt-4 text-sm text-ink-secondary">
          Por liquidar: <span className="font-medium tabular-nums text-ink">{euros(card.pending.soldCents)}</span> vendidos de{" "}
          {salesRangeLabel(card.pending.from, card.pending.to)} ainda sem crédito TPA.
        </p>
      )}

      {card.settlements.length === 0 ? (
        <p className="mt-4 text-sm text-ink-secondary">Sem créditos TPA neste período.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className={TABLE}>
            <thead className={THEAD}>
              <tr>
                <th className={TH}>Crédito</th>
                <th className={TH}>Vendas de</th>
                <th className={`${TH} text-right`}>Vendido</th>
                <th className={`${TH} text-right`}>Recebido</th>
                <th className={`${TH} text-right`}>Diferença</th>
                <th className={`${TH} text-right`}>Taxa</th>
                <th className={TH}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {card.settlements.map((s) => (
                <tr key={s.creditDate} className={TR}>
                  <td className={TD}>{salesRangeLabel(s.creditDate, s.creditDate)}</td>
                  <td className={TD}>{salesRangeLabel(s.salesFrom, s.salesTo)}</td>
                  <td className={`${TD} text-right tabular-nums`}>{euros(s.soldCents)}</td>
                  <td className={`${TD} text-right tabular-nums`}>{euros(s.receivedCents)}</td>
                  <td className={`${TD} text-right tabular-nums`}>{euros(s.differenceCents)}</td>
                  <td className={`${TD} text-right tabular-nums`}>{pctLabel(s.impliedFeePct)}</td>
                  <td className={TD}>
                    <StatusBadge tone={SETTLEMENT_STATUS[s.status].tone}>{SETTLEMENT_STATUS[s.status].label}</StatusBadge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/** Numerário do Vendus × depósitos. */
function CashSection({ report }: { report: SalesReconciliation }) {
  const { cash } = report;
  return (
    <section className={`${SURFACE} p-6`} aria-labelledby="rec-cash">
      <h2 id="rec-cash" className={SECTION_TITLE}>
        Venda restaurante dinheiro <span className="font-normal text-ink-secondary">· Vendus × depósitos</span>
      </h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <Kpi label="Vendido em numerário" value={euros(cash.soldCents)} />
        <Kpi label="Depositado" value={euros(cash.depositedCents)} />
        <Kpi label={cash.notDepositedCents >= 0 ? "Por depositar" : "Depositado a mais"} value={euros(Math.abs(cash.notDepositedCents))} />
      </div>
      {cash.deposits.length === 0 ? (
        <p className="mt-4 text-sm text-ink-secondary">Sem depósitos neste período.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className={TABLE}>
            <thead className={THEAD}>
              <tr>
                <th className={TH}>Depósito</th>
                <th className={`${TH} text-right`}>Depositado</th>
                <th className={`${TH} text-right`}>Vendido desde o anterior</th>
                <th className={`${TH} text-right`}>Diferença</th>
              </tr>
            </thead>
            <tbody>
              {cash.deposits.map((d) => (
                <tr key={d.date} className={TR}>
                  <td className={TD}>{salesRangeLabel(d.date, d.date)}</td>
                  <td className={`${TD} text-right tabular-nums`}>{euros(d.depositedCents)}</td>
                  <td className={`${TD} text-right tabular-nums`}>{euros(d.soldSincePreviousCents)}</td>
                  <td className={`${TD} text-right tabular-nums`}>{euros(d.soldSincePreviousCents - d.depositedCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/** Mapa de rentabilidade → Conferência de vendas: o que o Vendus faturou × o que entrou no banco. */
export function SalesReconciliationView({ year, month }: { year: number; month: number }) {
  const { report, loading, error, future } = useSalesReconciliation(year, month);

  return (
    <div className={`${PAGE_BG} mx-auto w-full max-w-6xl space-y-5 p-4 sm:p-6`}>
      {future ? (
        <EmptyState title="Este mês ainda não começou" description="Escolha um mês até ao atual." />
      ) : error ? (
        <AlertBanner tone="danger" title="Não foi possível carregar a conferência">
          {error}
        </AlertBanner>
      ) : loading || !report ? (
        <div className="space-y-5" aria-busy="true">
          <Skeleton className="h-64" />
          <Skeleton className="h-48" />
        </div>
      ) : (
        <>
          <p className="text-sm text-ink-secondary">
            <span className="font-semibold text-navy-900 first-letter:uppercase">{monthName(report.period.month)}</span>
            {report.period.isCurrentMonth && " · até hoje"} · cada crédito TPA cobre as vendas desde o crédito anterior (venda num dia, crédito
            no seguinte; o fim de semana junta-se à segunda).
          </p>
          <CardSection report={report} />
          <CashSection report={report} />
        </>
      )}
    </div>
  );
}
