import type { ReactNode } from "react";
import { AppIcon, Button, IconChevronLeft, IconChevronRight, IconFile, NUMERIC, SURFACE } from "../../../../components/ui/index.ts";
import type { AccountMonthStatDTO, BankStatementSummaryDTO } from "../../domain/entities/bank-statement.ts";
import { MONTH_NAMES_PT, monthReconciliation, type AccountYearSummary } from "../../domain/services/account-year.ts";
import { MonthStatusPill } from "./BankUi.tsx";
import { eur, signedEur } from "./money.ts";

/**
 * Vista da conta V3 (task «Bancos V3»): faixa única de indicadores, os 12 meses em Tabela ou Quadro (os
 * mesmos dados, sem cálculos próprios) e o resumo de um mês, com ou sem extrato. Menos caixas, números
 * tabulares, cor só em valores, etiquetas e barras.
 */

const flowClass = (cents: number) => (cents > 0 ? "text-emerald-600" : cents < 0 ? "text-red-600" : "text-navy-900");
const DASH = <span className="text-ink-muted">—</span>;

/** «2026-09-01…» → «01/09/2026». */
const fmtDay = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
};

/** Barra fina de progresso (acento da marca); a percentagem vai sempre em texto ao lado. */
function ThinBar({ percent, label, className = "" }: { percent: number; label: string; className?: string }) {
  return (
    <span
      role="progressbar"
      aria-label={label}
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      className={`block h-1.5 overflow-hidden rounded-full bg-surface-soft ${className}`}
    >
      <span className="block h-full rounded-full bg-brand-500" style={{ width: `${Math.max(percent, percent > 0 ? 2 : 0)}%` }} />
    </span>
  );
}

/** Extrato só de parte do mês: etiqueta discreta ao lado do estado (os totais são só dos dias cobertos). */
function PartialTag({ stat }: { stat: AccountMonthStatDTO | undefined }) {
  if (!stat?.partialPeriod) return null;
  return (
    <span title="O extrato não cobre o mês todo: os totais são só dos dias cobertos." className="whitespace-nowrap rounded-full border border-amber-200 px-2 py-0.5 text-[11px] font-medium text-amber-700">
      Período parcial
    </span>
  );
}

// ── Faixa de indicadores ──────────────────────────────────────────────────────

function Metric({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="min-w-0 py-1 xl:px-6 xl:first:pl-0">
      <p className="truncate text-xs text-ink-secondary">{label}</p>
      <div className={`mt-1.5 whitespace-nowrap text-[22px] font-bold leading-tight tracking-tight ${NUMERIC}`}>{children}</div>
      {hint && <div className="mt-1.5 text-xs text-ink-muted">{hint}</div>}
    </div>
  );
}

export function YearMetricsStrip({ summary, year }: { summary: AccountYearSummary; year: number }) {
  const none = summary.importedMonths === 0;
  return (
    <section aria-label={`Indicadores de ${year}`} className={`${SURFACE} px-5 py-4 sm:px-6`}>
      <p className="mb-3 text-xs text-ink-secondary">
        {none ? `Ainda não há extratos importados em ${year}.` : `Acumulado dos meses com extrato importado — ${year}`}
      </p>
      <div className="grid grid-cols-2 gap-y-4 md:grid-cols-3 xl:grid-cols-5 xl:divide-x xl:divide-line-subtle">
        <Metric label="Entradas">{none ? DASH : <span className="text-emerald-600">{eur(summary.inflowCents)}</span>}</Metric>
        <Metric label="Saídas">{none ? DASH : <span className="text-red-600">{eur(summary.outflowCents)}</span>}</Metric>
        <Metric label="Fluxo líquido bancário" hint="Entradas − saídas">
          {none ? DASH : <span className={flowClass(summary.netCents)}>{signedEur(summary.netCents)}</span>}
        </Metric>
        <Metric label="Meses importados" hint={<ThinBar percent={(summary.importedMonths / 12) * 100} label="Meses importados" className="w-28" />}>
          <span className="text-navy-900">{summary.importedMonths} / 12</span>
        </Metric>
        <Metric
          label="Conciliação do ano"
          hint={
            summary.reconciledPercent === null ? (none ? "Sem extratos" : "Sem movimentos conciliáveis") : (
              <span className="flex items-center gap-2">
                <ThinBar percent={summary.reconciledPercent} label="Conciliação do ano" className="w-28" />
                <span className={NUMERIC}>{summary.reconciledMovements} de {summary.reconcilableMovements}</span>
              </span>
            )
          }
        >
          {summary.reconciledPercent === null ? (
            <span className="text-base font-semibold text-ink-secondary">{none ? "—" : "Não aplicável"}</span>
          ) : (
            <span className="text-navy-900">{summary.reconciledPercent}%</span>
          )}
        </Metric>
      </div>
    </section>
  );
}

// ── Conciliação de um mês (tabela, quadro) ────────────────────────────────────

function MonthReconciliationCell({ stat, compact = false }: { stat: AccountMonthStatDTO | undefined; compact?: boolean }) {
  const r = monthReconciliation(stat);
  if (r.kind === "no_statement") return DASH;
  if (r.kind === "not_applicable") return <span className="text-xs text-ink-secondary">Não aplicável</span>;
  return (
    <span className="flex items-center gap-2.5" title={`${r.reconciled} de ${r.reconcilable} movimentos conciliáveis`}>
      {compact ? null : <span className={`w-9 text-right text-sm font-medium text-navy-900 ${NUMERIC}`}>{r.percent}%</span>}
      <ThinBar percent={r.percent} label={`Conciliação de ${r.percent}%`} className={compact ? "flex-1" : "w-24"} />
      {compact && <span className={`shrink-0 text-xs text-ink-secondary ${NUMERIC}`}>{r.percent}% conciliado</span>}
    </span>
  );
}

// ── Tabela (vista predefinida) ────────────────────────────────────────────────

export function MonthsTable({
  months,
  summary,
  onOpen,
  onImport,
}: {
  months: Map<number, AccountMonthStatDTO>;
  summary: AccountYearSummary;
  onOpen: (month: number) => void;
  onImport: () => void;
}) {
  const th = "px-3 py-2.5 text-xs font-medium text-ink-secondary";
  const td = `px-3 py-3 ${NUMERIC}`;
  return (
    <div className="relative overflow-x-auto">
      <table className="w-full min-w-[860px] text-sm">
        <thead className="border-b border-line-subtle">
          <tr>
            <th className={`${th} pl-0 text-left`}>Mês</th>
            <th className={`${th} text-right`}>Movimentos</th>
            <th className={`${th} text-right`}>Entradas</th>
            <th className={`${th} text-right`}>Saídas</th>
            <th className={`${th} text-right`}>Fluxo líquido</th>
            <th className={`${th} pl-6 text-left`}>Conciliação</th>
            <th className={`${th} text-left`}>Estado</th>
            <th className={`${th} pr-0 text-right`}><span className="sr-only">Ações</span></th>
          </tr>
        </thead>
        <tbody>
          {MONTH_NAMES_PT.map((name, i) => {
            const m = i + 1;
            const s = months.get(m);
            const has = !!s?.statementImported;
            return (
              <tr
                key={m}
                onClick={() => onOpen(m)}
                className="cursor-pointer border-b border-line-subtle transition-colors last:border-0 hover:bg-surface-soft/60"
              >
                <td className="py-3 pl-0 pr-3">
                  <button type="button" onClick={(e) => { e.stopPropagation(); onOpen(m); }} className="font-semibold text-navy-900 hover:text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 rounded">
                    {name}
                  </button>
                </td>
                <td className={`${td} text-right text-ink-secondary`}>{has ? s!.totalMovements : DASH}</td>
                <td className={`${td} text-right text-navy-900`}>{has ? eur(s!.inflowCents) : DASH}</td>
                <td className={`${td} text-right text-navy-900`}>{has ? eur(s!.outflowCents) : DASH}</td>
                <td className={`${td} text-right font-semibold ${has ? flowClass(s!.netCents) : ""}`}>{has ? signedEur(s!.netCents) : DASH}</td>
                <td className="py-3 pl-6 pr-3"><MonthReconciliationCell stat={s} /></td>
                <td className="px-3 py-3">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <MonthStatusPill status={s?.status ?? "no_statement"} />
                    <PartialTag stat={s} />
                  </span>
                </td>
                <td className="py-3 pl-3 pr-0 text-right">
                  {has ? (
                    <span className="inline-flex items-center gap-1 text-[13px] font-medium text-brand-600">
                      Abrir <IconChevronRight size={14} />
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onImport(); }}
                      className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[13px] font-medium text-brand-600 hover:bg-brand-50"
                    >
                      <AppIcon name="upload" size={14} /> Importar
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
        {summary.importedMonths > 0 && (
          <tfoot>
            <tr className="border-t border-line bg-surface-soft/50 font-semibold">
              <td className="py-3 pl-3 pr-3 text-navy-900">
                Total <span className="font-normal text-ink-secondary">({summary.importedMonths} {summary.importedMonths === 1 ? "mês importado" : "meses importados"})</span>
              </td>
              <td className={`${td} text-right text-navy-900`}>{summary.totalMovements}</td>
              <td className={`${td} text-right text-navy-900`}>{eur(summary.inflowCents)}</td>
              <td className={`${td} text-right text-navy-900`}>{eur(summary.outflowCents)}</td>
              <td className={`${td} text-right ${flowClass(summary.netCents)}`}>{signedEur(summary.netCents)}</td>
              <td className="py-3 pl-6 pr-3 text-sm text-navy-900">{summary.reconciledPercent === null ? <span className="text-xs font-normal text-ink-secondary">Não aplicável</span> : `${summary.reconciledPercent}%`}</td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

// ── Quadro (alternativa) ──────────────────────────────────────────────────────

export function MonthsBoard({
  months,
  onOpen,
  onImport,
}: {
  months: Map<number, AccountMonthStatDTO>;
  onOpen: (month: number) => void;
  onImport: () => void;
}) {
  return (
    <div className="grid gap-px overflow-hidden rounded-xl border border-line-subtle bg-line-subtle sm:grid-cols-2 xl:grid-cols-4">
      {MONTH_NAMES_PT.map((name, i) => {
        const m = i + 1;
        const s = months.get(m);
        const has = !!s?.statementImported;
        return (
          <div key={m} className="flex flex-col bg-surface-card p-4 sm:min-h-[148px]">
            <div className="flex items-center justify-between gap-2">
              <button type="button" onClick={() => onOpen(m)} className="font-semibold text-navy-900 hover:text-brand-600">{name}</button>
              <span className="flex items-center gap-1.5">
                <PartialTag stat={s} />
                <MonthStatusPill status={s?.status ?? "no_statement"} />
              </span>
            </div>
            {has ? (
              <button type="button" onClick={() => onOpen(m)} className="mt-3 flex flex-1 flex-col text-left">
                <dl className={`grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-[13px] ${NUMERIC}`}>
                  <dt className="text-ink-secondary">Movimentos</dt><dd className="text-right text-navy-900">{s!.totalMovements}</dd>
                  <dt className="text-ink-secondary">Entradas</dt><dd className="text-right text-navy-900">{eur(s!.inflowCents)}</dd>
                  <dt className="text-ink-secondary">Saídas</dt><dd className="text-right text-navy-900">{eur(s!.outflowCents)}</dd>
                  <dt className="text-ink-secondary">Fluxo líquido</dt><dd className={`text-right font-semibold ${flowClass(s!.netCents)}`}>{signedEur(s!.netCents)}</dd>
                </dl>
                <span className="mt-auto pt-3"><MonthReconciliationCell stat={s} compact /></span>
              </button>
            ) : (
              <div className="mt-2 flex items-center justify-between sm:mt-auto sm:pt-6">
                <span className="text-xs text-ink-muted">Sem dados do mês</span>
                <button type="button" onClick={onImport} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[13px] font-medium text-brand-600 hover:bg-brand-50">
                  <AppIcon name="upload" size={14} /> Importar
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Resumo de um mês ──────────────────────────────────────────────────────────

export function MonthSummary({
  stat,
  year,
  month,
  canPrev,
  canNext,
  onPrev,
  onNext,
  onBack,
  onOpenMovements,
  onImport,
  statements,
  balances,
  onDeleteStatement,
}: {
  stat: AccountMonthStatDTO | undefined;
  year: number;
  month: number;
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onBack: () => void;
  onOpenMovements: () => void;
  onImport: () => void;
  /** Extratos que tocam o mês (para eliminar e voltar a importar). */
  statements: BankStatementSummaryDTO[];
  /** Saldos tirados do extrato (só se bate certo); `null` quando não há. */
  balances: { openingCents: number | null; closingCents: number | null };
  /** Um extrato («Eliminar extrato») ou todos os do mês («Eliminar todos»). */
  onDeleteStatement: (statements: BankStatementSummaryDTO[]) => void;
}) {
  const name = MONTH_NAMES_PT[month - 1]!;
  const prevName = MONTH_NAMES_PT[(month + 10) % 12]!;
  const nextName = MONTH_NAMES_PT[month % 12]!;
  const has = !!stat?.statementImported;
  const r = monthReconciliation(stat);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-subtle pb-4">
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-secondary hover:text-navy-900">
            <IconChevronLeft size={14} /> Voltar à visão anual
          </button>
          <span className="hidden h-4 w-px bg-line sm:block" />
          <h3 className="text-lg font-bold text-navy-900">{name} {year}</h3>
          <MonthStatusPill status={stat?.status ?? "no_statement"} />
          <PartialTag stat={stat} />
          {has && <span className={`text-[13px] text-ink-secondary ${NUMERIC}`}>{stat!.totalMovements} movimentos importados</span>}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={onPrev} disabled={!canPrev} icon={<IconChevronLeft size={14} />}>{prevName}</Button>
          <Button size="sm" onClick={onNext} disabled={!canNext}>{nextName} <IconChevronRight size={14} /></Button>
        </div>
      </div>

      {!has ? (
        <div className="flex flex-col items-start gap-3 py-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><IconFile size={20} /></span>
            <div>
              <p className="font-semibold text-navy-900">Ainda não há extrato de {name.toLowerCase()} de {year}.</p>
              <p className="mt-1 max-w-xl text-sm text-ink-secondary">
                Importa o extrato para consultar os movimentos, o fluxo líquido e a conciliação deste mês. Não são apresentados valores estimados.
              </p>
            </div>
          </div>
          <Button variant="primary" icon={<AppIcon name="upload" size={16} />} onClick={onImport}>Importar extrato</Button>
        </div>
      ) : (
        <>
          {stat!.partialPeriod && (
            <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-[13px] text-amber-800">
              O extrato importado não cobre o mês todo: entradas, saídas e conciliação referem-se só aos dias cobertos. Importa o resto do mês para completar.
            </p>
          )}
          <div className="grid gap-y-4 py-5 sm:grid-cols-3 sm:divide-x sm:divide-line-subtle">
            {[
              { label: "Entradas", value: eur(stat!.inflowCents), cls: "text-emerald-600" },
              { label: "Saídas", value: eur(stat!.outflowCents), cls: "text-red-600" },
              { label: "Fluxo líquido", value: signedEur(stat!.netCents), cls: flowClass(stat!.netCents) },
            ].map((x) => (
              <div key={x.label} className="sm:px-6 sm:first:pl-0">
                <p className="text-xs text-ink-secondary">{x.label}</p>
                <p className={`mt-1 text-2xl font-bold tracking-tight ${NUMERIC} ${x.cls}`}>{x.value}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-4 border-t border-line-subtle pt-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0 flex-1 lg:max-w-xl">
              <p className="text-xs text-ink-secondary">Conciliação</p>
              {r.kind === "percent" ? (
                <>
                  <div className="mt-1.5 flex items-center gap-3">
                    <ThinBar percent={r.percent} label={`Conciliação de ${r.percent}%`} className="flex-1" />
                    <span className={`text-sm font-semibold text-navy-900 ${NUMERIC}`}>{r.percent}%</span>
                  </div>
                  <p className={`mt-1.5 text-[13px] text-ink-secondary ${NUMERIC}`}>
                    {r.reconciled} de {r.reconcilable} movimentos conciliáveis
                    {r.outside > 0 && <> · {r.outside} {r.outside === 1 ? "entrada aceite" : "entradas aceites"} automaticamente na importação não {r.outside === 1 ? "conta" : "contam"}</>}
                  </p>
                </>
              ) : (
                <p className="mt-1.5 text-sm text-ink-secondary">
                  Não aplicável — {r.kind === "not_applicable" && r.outside > 0 ? "só entradas aceites automaticamente, nada para conciliar." : "sem movimentos para conciliar."}
                </p>
              )}
              {(balances.openingCents !== null || balances.closingCents !== null) && (
                <p className={`mt-2 text-xs text-ink-muted ${NUMERIC}`}>
                  {balances.openingCents !== null && <>Saldo inicial do extrato: {eur(balances.openingCents)}</>}
                  {balances.openingCents !== null && balances.closingCents !== null && " · "}
                  {balances.closingCents !== null && <>saldo final: {eur(balances.closingCents)}</>}
                </p>
              )}
            </div>
            <Button variant="primary" onClick={onOpenMovements}>Ver movimentos <IconChevronRight size={14} /></Button>
          </div>
        </>
      )}

      {statements.length > 0 && (
        <div className="mt-5 border-t border-line-subtle pt-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-xs text-ink-secondary">
              {statements.length === 1 ? "Extrato deste mês" : `Extratos deste mês (${statements.length})`}
            </p>
            {statements.length > 1 && (
              <button
                type="button"
                onClick={() => onDeleteStatement(statements)}
                className="rounded-lg border border-red-200 px-2.5 py-1 text-[13px] font-medium text-red-600 hover:bg-red-50"
              >
                Eliminar todos ({statements.length})
              </button>
            )}
          </div>
          <ul className="divide-y divide-line-subtle">
            {statements.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-2 text-[13px]">
                <span className={`text-navy-900 ${NUMERIC}`}>
                  {fmtDay(s.periodStart)} – {fmtDay(s.periodEnd)}
                  <span className="text-ink-secondary"> · {s.sourceType.toUpperCase()} · {s.importedMovementsCount} movimentos · importado em {fmtDay(s.createdAt)}</span>
                </span>
                <button
                  type="button"
                  onClick={() => onDeleteStatement([s])}
                  className="rounded-lg px-2 py-1 text-[13px] font-medium text-red-600 hover:bg-red-50"
                >
                  Eliminar extrato
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
