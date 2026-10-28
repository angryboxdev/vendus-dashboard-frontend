import {
  AlertBanner,
  Button,
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
import { formatEUR } from "../../../../lib/format.ts";
import type { ImportPlatformDocumentsResult, PlatformStatementSummary } from "../../domain/entities/platform-statement.ts";
import {
  crossesMonth,
  DOCUMENT_LABELS,
  MAX_UPLOAD_FILES,
  periodLabel,
  PLATFORM_LABELS,
  platformCostsCents,
  totalsByPlatform,
} from "../../domain/services/platform-statements-view.ts";
import { MarginReportCard } from "./MarginReportCard.tsx";
import { useDeliveryPlatforms } from "./use-delivery-platforms.ts";

const euros = (cents: number) => formatEUR(cents / 100);

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <p className="text-xs text-ink-secondary">{label}</p>
      <p className="text-lg font-semibold tabular-nums text-navy-900">{value}</p>
      {hint && <p className="text-xs text-ink-secondary">{hint}</p>}
    </div>
  );
}

function ImportResult({ result }: { result: ImportPlatformDocumentsResult }) {
  return (
    <div className="mt-4 space-y-2">
      {result.imported.length > 0 && (
        <AlertBanner tone="success" title={`${result.imported.length} extrato(s) importado(s)`}>
          <ul className="space-y-0.5">
            {result.imported.map((d) => (
              <li key={d.fileName}>
                {PLATFORM_LABELS[d.platform]} · {periodLabel(d.periodFrom, d.periodTo)} · líquido {euros(d.netPayoutCents)}
                {d.replaced && " · substituiu o anterior"}
              </li>
            ))}
          </ul>
        </AlertBanner>
      )}
      {result.rejected.length > 0 && (
        <AlertBanner tone="warning" title={`${result.rejected.length} ficheiro(s) não importado(s)`}>
          <ul className="space-y-0.5">
            {result.rejected.map((r) => (
              <li key={r.fileName}>
                <span className="font-medium">{r.fileName}</span>: {r.reason}
              </li>
            ))}
          </ul>
        </AlertBanner>
      )}
    </div>
  );
}

function StatementsTable({ statements, year, month }: { statements: PlatformStatementSummary[]; year: number; month: number }) {
  return (
    <div className="mt-4 overflow-x-auto">
      <table className={TABLE}>
        <thead className={THEAD}>
          <tr>
            <th className={TH}>Plataforma</th>
            <th className={TH}>Período</th>
            <th className={TH}>Documento</th>
            <th className={`${TH} text-right`}>Pedidos</th>
            <th className={`${TH} text-right`}>Vendas</th>
            <th className={`${TH} text-right`}>Promoções</th>
            <th className={`${TH} text-right`}>Comissões</th>
            <th className={`${TH} text-right`}>Marketing</th>
            <th className={`${TH} text-right`}>Outras taxas</th>
            <th className={`${TH} text-right`}>Líquido</th>
          </tr>
        </thead>
        <tbody>
          {statements.map((s) => (
            <tr key={s.id} className={TR}>
              <td className={TD}>{PLATFORM_LABELS[s.platform]}</td>
              <td className={TD}>
                {periodLabel(s.periodFrom, s.periodTo)}
                {crossesMonth(s, year, month) && (
                  <span className="ml-2">
                    <StatusBadge tone="neutral">Atravessa o mês</StatusBadge>
                  </span>
                )}
              </td>
              <td className={TD}>
                {DOCUMENT_LABELS[s.documentKind]} <span className="text-ink-secondary">{s.documentNumber}</span>
              </td>
              <td className={`${TD} text-right tabular-nums`}>{s.ordersCount ?? "—"}</td>
              <td className={`${TD} text-right tabular-nums`}>{euros(s.salesCents)}</td>
              <td className={`${TD} text-right tabular-nums`}>{euros(s.promotionsCents)}</td>
              <td className={`${TD} text-right tabular-nums`}>{euros(s.commissionCents)}</td>
              <td className={`${TD} text-right tabular-nums`}>{euros(s.marketingCents)}</td>
              <td className={`${TD} text-right tabular-nums`}>{euros(s.otherFeesCents + s.refundsCents + s.adjustmentsCents)}</td>
              <td className={`${TD} text-right font-medium tabular-nums`}>{euros(s.netPayoutCents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Mapa de rentabilidade → Plataformas de delivery: importar os documentos (Uber, Glovo, Bolt, SAF-T), a
 * margem por plataforma do mês (com exportação) e os documentos do mês (com IVA, como vêm).
 */
export function DeliveryPlatformsView({ year, month }: { year: number; month: number }) {
  const v = useDeliveryPlatforms(year, month);
  const platformStatements = v.statements.filter((s) => s.platform !== "airmenu");
  const totals = totalsByPlatform(v.statements);

  return (
    <div className={`${PAGE_BG} mx-auto w-full max-w-6xl space-y-5 p-4 sm:p-6`}>
      <section className={`${SURFACE} p-6`} aria-labelledby="dp-import">
        <h2 id="dp-import" className={SECTION_TITLE}>
          Importar extratos
        </h2>
        <p className="mt-1 text-sm text-ink-secondary">
          Uber Eats: extrato mensal (PDF). Glovo: extratos quinzenais (PDF). Bolt Food: relatório de pedidos (CSV) e faturas semanais (PDF).
          Opcional: SAF-T de vendas do AirMenu (XML), para conferir. Até {MAX_UPLOAD_FILES} ficheiros de cada vez; cada documento só é
          gravado se as contas baterem, e importar outra vez o mesmo documento substitui o anterior.
        </p>
        <label className="mt-4 block text-sm font-medium text-ink" htmlFor="dp-files">
          Ficheiros
        </label>
        <input
          id="dp-files"
          type="file"
          accept=".pdf,.csv,.xml,application/pdf,text/csv,text/xml,application/xml"
          multiple
          onChange={(e) => {
            v.addFiles(Array.from(e.target.files ?? []));
            e.target.value = ""; // permite voltar a escolher o mesmo ficheiro depois de o remover
          }}
          className="mt-2 block w-full text-sm text-ink-secondary file:mr-3 file:rounded-lg file:border-0 file:bg-surface-soft file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-ink"
        />
        {v.files.length > 0 && (
          <ul className="mt-3 divide-y divide-line-subtle rounded-xl border border-line-subtle">
            {v.files.map((f) => (
              <li key={f.name} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <span className="min-w-0 truncate text-ink">{f.name}</span>
                <button
                  type="button"
                  onClick={() => v.removeFile(f.name)}
                  className="shrink-0 text-xs font-medium text-ink-secondary hover:text-red-600"
                  aria-label={`Remover ${f.name}`}
                >
                  Remover
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4">
          <Button variant="primary" disabled={!v.canImport} loading={v.importing} onClick={v.importFiles}>
            {v.importing ? "A importar…" : "Importar"}
          </Button>
        </div>
        {v.selectionError && <p className="mt-2 text-sm text-amber-600">{v.selectionError}</p>}
        {v.importError && (
          <p role="alert" className="mt-2 text-sm text-red-600">
            {v.importError}
          </p>
        )}
        {v.result && <ImportResult result={v.result} />}
      </section>

      {v.loadError ? (
        <AlertBanner tone="danger" title="Não foi possível carregar os extratos">
          {v.loadError}
        </AlertBanner>
      ) : v.loading ? (
        <Skeleton className="h-48" />
      ) : v.statements.length === 0 ? (
        <EmptyState title="Sem extratos neste mês" description="Importe os extratos da Uber, da Glovo e da Bolt para ver o mês." />
      ) : (
        <>
          <MarginReportCard year={year} month={month} />
          {platformStatements.length > 0 && (
            <section className={`${SURFACE} p-6`} aria-labelledby="dp-month">
              <h2 id="dp-month" className={SECTION_TITLE}>
                Extratos do mês <span className="font-normal text-ink-secondary">· valores com IVA, como nos extratos</span>
              </h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                {totals.map((t) => (
                  <div key={t.platform} className="rounded-xl bg-surface-soft p-4">
                    <p className="text-sm font-semibold text-navy-900">{PLATFORM_LABELS[t.platform]}</p>
                    <div className="mt-2 grid grid-cols-2 gap-3">
                      <Kpi label="Vendas" value={euros(t.salesCents)} hint={`${t.ordersCount} pedidos`} />
                      <Kpi
                        label={t.platform === "bolt_food" ? "Líquido (calculado)" : "Transferido"}
                        value={euros(t.netPayoutCents)}
                        hint={`Plataforma ficou com ${euros(t.platformCostsCents)}`}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <StatementsTable statements={platformStatements} year={year} month={month} />
              {platformStatements.some((s) => s.platform === "bolt_food") && (
                <p className="mt-3 text-xs text-ink-secondary">
                  Bolt: o relatório de pedidos traz as vendas e as faturas semanais as taxas (IVA em autoliquidação); o líquido é a
                  diferença. Na fatura, o «investimento na campanha» é a parte da campanha paga pela Bolt (abate ao marketing).
                </p>
              )}
              {platformStatements.some((s) => crossesMonth(s, year, month)) && (
                <p className="mt-3 text-xs text-ink-secondary">
                  «Atravessa o mês»: o extrato cobre dias de outro mês e aparece nos dois; a repartição por mês entra com o relatório de
                  margem.
                </p>
              )}
              {platformStatements.some((s) => s.cashCents > 0) && (
                <p className="mt-1 text-xs text-ink-secondary">
                  Inclui pedidos pagos em dinheiro ao estafeta ({euros(platformStatements.reduce((a, s) => a + s.cashCents, 0))}
                  ), que não entram na transferência.
                </p>
              )}
              <p className="mt-1 text-xs text-ink-secondary">
                Total que as plataformas ficaram (promoções, comissões, marketing, taxas e reembolsos):{" "}
                {euros(platformStatements.reduce((a, s) => a + platformCostsCents(s), 0))}.
              </p>
            </section>
          )}
        </>
      )}
    </div>
  );
}
