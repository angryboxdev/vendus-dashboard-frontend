import { AlertBanner, SECTION_TITLE, SURFACE, Skeleton, StatusBadge, TABLE, TD, TH, THEAD, TR, type StatusTone } from "../../../../components/ui/index.ts";
import { formatEUR } from "../../../../lib/format.ts";
import type { PayoutStatus } from "../../domain/entities/payout-reconciliation.ts";
import { periodLabel, PLATFORM_LABELS } from "../../domain/services/platform-statements-view.ts";
import { usePayoutReconciliation } from "./use-payout-reconciliation.ts";

const euros = (cents: number) => formatEUR(cents / 100);
const day = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const STATUS: Record<PayoutStatus, { label: string; tone: StatusTone }> = {
  ok: { label: "Bate", tone: "success" },
  difference: { label: "Diferença", tone: "warning" },
  pending: { label: "Por receber", tone: "neutral" },
  missing: { label: "Em falta", tone: "danger" },
};

/** Transferências que pagam as vendas do mês (pelos documentos) × créditos das plataformas no banco. */
export function PayoutsCard({ year, month }: { year: number; month: number }) {
  const { reconciliation: r, loading, error } = usePayoutReconciliation(year, month);
  if (error) {
    return (
      <AlertBanner tone="danger" title="Não foi possível conferir as transferências">
        {error}
      </AlertBanner>
    );
  }
  if (loading || !r) return <Skeleton className="h-48" />;
  if (r.payouts.length === 0 && r.unmatchedCredits.length === 0) return null;

  return (
    <section className={`${SURFACE} p-6`} aria-labelledby="dp-payouts">
      <h2 id="dp-payouts" className={SECTION_TITLE}>
        Transferências <span className="font-normal text-ink-secondary">· o que os documentos dizem × o que entrou no banco</span>
      </h2>
      {r.totals.length > 0 && (
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {r.totals.map((t) => (
            <div key={t.platform} className="rounded-xl bg-surface-soft p-4 text-sm">
              <p className="font-semibold text-navy-900">{PLATFORM_LABELS[t.platform]}</p>
              <p className="mt-1 tabular-nums">
                Esperado {euros(t.expectedCents)} · recebido {euros(t.receivedCents)}
              </p>
              <p className="text-xs text-ink-secondary tabular-nums">
                {t.differenceCents !== 0 ? `Diferença ${euros(t.differenceCents)}` : "Sem diferenças"}
                {t.pendingCents !== 0 ? ` · por receber ${euros(t.pendingCents)}` : ""}
              </p>
            </div>
          ))}
        </div>
      )}
      {r.payouts.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <table className={TABLE}>
            <thead className={THEAD}>
              <tr>
                <th className={TH}>Plataforma</th>
                <th className={TH}>Vendas de</th>
                <th className={`${TH} text-right`}>Esperado</th>
                <th className={TH}>Entrou no banco</th>
                <th className={`${TH} text-right`}>Recebido</th>
                <th className={`${TH} text-right`}>Diferença</th>
                <th className={TH}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {r.payouts.map((p) => (
                <tr key={`${p.platform}-${p.periodFrom}-${p.periodTo}`} className={TR}>
                  <td className={TD}>{PLATFORM_LABELS[p.platform]}</td>
                  <td className={TD}>{periodLabel(p.periodFrom, p.periodTo)}</td>
                  <td className={`${TD} text-right tabular-nums`}>{euros(p.expectedCents)}</td>
                  <td className={TD}>{p.received ? day(p.received.date) : `até ${day(p.dueBy)}`}</td>
                  <td className={`${TD} text-right tabular-nums`}>{p.received ? euros(p.received.amountCents) : "—"}</td>
                  <td className={`${TD} text-right tabular-nums`}>{p.differenceCents === null ? "—" : euros(p.differenceCents)}</td>
                  <td className={TD}>
                    <StatusBadge tone={STATUS[p.status].tone}>{STATUS[p.status].label}</StatusBadge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {r.unmatchedCredits.length > 0 && (
        <p className="mt-3 text-xs text-ink-secondary">
          Créditos no banco sem transferência esperada neste mês (pagam outro mês ou falta o documento):{" "}
          {r.unmatchedCredits.map((c) => `${PLATFORM_LABELS[c.platform]} ${day(c.date)} ${euros(c.amountCents)}`).join(" · ")}.
        </p>
      )}
      {r.warnings.length > 0 && (
        <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-ink-secondary">
          {r.warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
