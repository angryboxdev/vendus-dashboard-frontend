import { useQuery } from "@tanstack/react-query";
import { AlertBanner, Drawer, Skeleton, StatusBadge, type StatusTone } from "../../../../components/ui/index.ts";
import { useCashFlowModule } from "../../cash-flow.module.tsx";
import type { DreSectionKey, DreVatBasis } from "../../domain/entities/dre.ts";
import { monthName } from "../../domain/services/cash-flow-view.ts";
import { ENTRY_BASIS_LABELS, VAT_BASIS_LABELS, groupDreEntries, shortDate } from "../../domain/services/dre-entries-view.ts";
import { euros } from "./cash-flow-format.ts";

const VAT_TONE: Record<DreVatBasis, StatusTone> = { exempt: "neutral", real: "success", estimated: "neutral", pending: "warning" };

export interface DrePaymentsTarget {
  /** Uma linha da DRE, ou várias (um grupo do «Controle geral»). */
  section: DreSectionKey | "off_operation" | (DreSectionKey | "off_operation")[];
  title: string;
  /** Nome de cada rubrica da linha (`itemKey` → nome). */
  labels: Map<string, string>;
}

/**
 * Os pagamentos por trás de uma linha da DRE, para conferir a classificação: por rubrica, com a data do
 * pagamento e a da competência (a da fatura), o documento e de onde vem a categoria e o IVA.
 */
export function DrePaymentsDrawer({ year, month, target, onClose }: { year: number; month: number; target: DrePaymentsTarget | null; onClose: () => void }) {
  const { getDreEntries } = useCashFlowModule();
  const query = useQuery({
    queryKey: ["dre-entries", year, month],
    queryFn: () => getDreEntries.execute(year, month),
    enabled: target !== null,
    retry: false,
  });
  const groups = target && query.data ? groupDreEntries(query.data.entries, target.section, target.labels) : [];
  const total = groups.reduce((a, g) => a + g.netCents, 0);

  return (
    <Drawer
      open={target !== null}
      onClose={onClose}
      width="max-w-2xl"
      title={target?.title ?? "Pagamentos"}
      description={`${monthName(month)} ${year} · pelo mês da fatura (sem fatura, pela data do pagamento); inclui as faturas do mês ainda por pagar`}
    >
      {query.error ? (
        <AlertBanner tone="danger" title="Não foi possível carregar os pagamentos">
          {query.error instanceof Error ? query.error.message : "Erro ao carregar"}
        </AlertBanner>
      ) : query.data === null ? (
        <AlertBanner tone="info" title="Sem acesso">
          Os pagamentos mostram o descritivo do extrato bancário — é preciso a permissão «Bancos & conciliação».
        </AlertBanner>
      ) : !query.data ? (
        <Skeleton className="h-96" />
      ) : groups.length === 0 ? (
        <p className="text-sm text-ink-secondary">Sem pagamentos nesta linha.</p>
      ) : (
        <div className="space-y-6">
          <p className="flex justify-between text-sm">
            <span className="text-ink-secondary">Total sem IVA</span>
            <span className="font-semibold tabular-nums text-navy-900">{euros(total)}</span>
          </p>
          {groups.map((g) => (
            <section key={g.key} aria-label={g.label}>
              <div className="flex items-baseline justify-between gap-3 border-b border-line-subtle pb-1.5">
                <h3 className="text-sm font-semibold text-navy-900">
                  {g.label} <span className="font-normal text-ink-secondary">· {g.entries.length}</span>
                </h3>
                <span className="text-sm font-semibold tabular-nums text-navy-900">{euros(g.netCents)}</span>
              </div>
              <ul className="divide-y divide-line-subtle">
                {g.entries.map((e, i) => (
                  <li key={`${e.movementId}-${i}`} className="flex items-start justify-between gap-4 py-2.5">
                    <div className="min-w-0 text-sm">
                      <p className="truncate text-ink">{e.document ?? e.description ?? "Pagamento"}</p>
                      {e.document && e.description && <p className="truncate text-xs text-ink-secondary">{e.description}</p>}
                      <p className="mt-0.5 text-xs text-ink-secondary">
                        {e.paidOn === null ? (
                          <>Por pagar · fatura de {shortDate(e.competenceDate)}</>
                        ) : (
                          <>
                            Pago a {shortDate(e.paidOn)}
                            {e.competenceDate !== e.paidOn && <> · fatura de {shortDate(e.competenceDate)}</>}
                          </>
                        )}
                        {" · "}
                        {ENTRY_BASIS_LABELS[e.basis]}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="text-sm tabular-nums text-ink">{euros(e.netCents)}</span>
                      {e.grossCents !== e.netCents && <span className="text-xs tabular-nums text-ink-secondary">{euros(e.grossCents)} com IVA</span>}
                      <StatusBadge tone={VAT_TONE[e.vatBasis]} dot={false}>
                        {VAT_BASIS_LABELS[e.vatBasis]}
                      </StatusBadge>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </Drawer>
  );
}
