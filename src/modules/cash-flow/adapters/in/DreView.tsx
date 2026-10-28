import { useState } from "react";
import { Link } from "react-router-dom";
import { AlertBanner, Button, EmptyState, IconButton, IconChevronDown, IconReceipt, PAGE_BG, SECTION_TITLE, SURFACE, Skeleton } from "../../../../components/ui/index.ts";
import { useOptionalAuth } from "../../../../contexts/AuthContext";
import { hasLevel } from "../../../access/domain/services/access-ui.service.ts";
import type { DreReport } from "../../domain/entities/dre.ts";
import { monthName } from "../../domain/services/cash-flow-view.ts";
import { composeDreStatement, type DreStatement, type StatementLine } from "../../domain/services/dre-statement.ts";
import { dreConfidencePct, platformLabel } from "../../domain/services/dre-view.ts";
import { euros, kindLabel } from "./cash-flow-format.ts";
import { useDre } from "./use-dre.ts";
import { DreParametersDrawer } from "./DreParametersDrawer.tsx";
import { DrePaymentsDrawer, type DrePaymentsTarget } from "./DrePaymentsDrawer.tsx";

/** Vê os pagamentos de cada rubrica: mostram o descritivo do extrato — Admin ou «Bancos & conciliação». */
function useCanSeePayments(): boolean {
  const access = useOptionalAuth()?.user?.access;
  return !!access && !access.portalOnly && (access.isAdmin || hasLevel(access.permissions, "finance.banking", "READ"));
}

const ROW = "flex items-baseline justify-between gap-4 py-2.5";
const AMOUNT = "shrink-0 text-sm tabular-nums";

const Pending = ({ className = "h-4 w-20" }: { className?: string }) => <Skeleton className={className} />;

const pctText = (pct: number | null) => (pct === null ? "" : `${pct.toLocaleString("pt-PT", { maximumFractionDigits: 1 })}%`);

/** Uma linha da DRE: valores com «−» nos custos, subtotais a negrito, detalhe abrível e, nas rubricas do banco, os pagamentos. */
function StatementRow({ line, onPayments }: { line: StatementLine; onPayments?: (line: StatementLine) => void }) {
  const [open, setOpen] = useState(false);
  if (line.kind === "heading") {
    return <li className="px-3 pb-1 pt-5 text-xs font-semibold uppercase tracking-wide text-ink-secondary">{line.label}</li>;
  }
  const canOpenPayments = !!onPayments && !!line.entriesSection && line.amountCents !== null && line.amountCents !== 0;
  const expandable = line.children.length > 0;
  const isCost = line.kind === "cost" || line.kind === "info";
  const strong = line.kind === "subtotal" || line.kind === "result";
  const value =
    line.amountCents === null ? null : isCost && line.amountCents !== 0 ? `− ${euros(line.amountCents)}` : euros(line.amountCents);
  const negative = !isCost && line.amountCents !== null && line.amountCents < 0;
  return (
    <li className={line.kind === "result" ? "border-t-2 border-navy-900/20" : line.kind === "subtotal" ? "bg-surface-soft/60" : line.kind === "info" ? "opacity-75" : ""}>
      <div className="flex items-center">
      <button
        type="button"
        className={`${ROW} min-w-0 flex-1 px-3 text-left disabled:cursor-default`}
        onClick={() => setOpen(!open)}
        disabled={!expandable}
        aria-expanded={expandable ? open : undefined}
      >
        <span className={`flex min-w-0 items-center gap-2 ${strong ? "text-sm font-semibold text-navy-900" : `text-sm text-ink ${line.kind === "cost" ? "pl-3" : ""}`}`}>
          <span>
            {line.kind === "cost" ? "(−) " : line.kind === "subtotal" || line.kind === "result" ? "= " : ""}
            {line.label}
            {line.hint && <span className="block text-xs font-normal text-ink-secondary">{line.hint}</span>}
          </span>
          {expandable && <IconChevronDown size={14} className={`text-ink-muted transition-transform ${open ? "rotate-180" : ""}`} />}
        </span>
        <span className="flex shrink-0 items-baseline gap-3">
          {value === null ? (
            <Pending />
          ) : (
            <span className={`${AMOUNT} ${strong ? "font-semibold" : ""} ${negative ? "text-rose-600" : strong ? "text-navy-900" : "text-ink"} ${line.kind === "result" ? "text-base" : ""}`}>
              {value}
            </span>
          )}
          <span className="w-12 text-right text-xs tabular-nums text-ink-secondary">{pctText(line.pctOfNet)}</span>
        </span>
      </button>
      {onPayments && (
        <span className="w-9 shrink-0">
          {canOpenPayments && (
            <IconButton size="sm" label={`Ver pagamentos — ${line.label}`} onClick={() => onPayments(line)}>
              <IconReceipt size={14} />
            </IconButton>
          )}
        </span>
      )}
      </div>
      {open && (
        <ul className="mb-2 ml-9 mr-16 space-y-1.5 border-l border-line-subtle pl-3">
          {line.children.map((ch) => (
            <li key={ch.key} className="flex items-baseline justify-between gap-3 text-xs">
              <span className="text-ink-secondary">
                {ch.label}
                {ch.hint && <span className="block">{ch.hint}</span>}
              </span>
              <span className="tabular-nums text-ink">{euros(ch.amountCents)}</span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

/** Demonstração de resultados em cascata, até ao lucro líquido da operação. */
function Statement({ statement, costs, onPayments }: { statement: DreStatement; costs: DreReport | null; onPayments?: (line: StatementLine) => void }) {
  const p = costs?.parameters;
  return (
    <section className={`${SURFACE} p-6`} aria-labelledby="dre-statement">
      <div className="flex items-baseline justify-between gap-4">
        <h2 id="dre-statement" className={SECTION_TITLE}>
          Demonstração de resultados <span className="font-normal text-ink-secondary">· sem IVA</span>
        </h2>
        <span className="text-xs text-ink-secondary">% da receita líquida</span>
      </div>
      <ul className="mt-3 divide-y divide-line-subtle">
        {statement.lines.map((line) => (
          <StatementRow key={line.key} line={line} onPayments={onPayments} />
        ))}
      </ul>
      {p && (
        <p className="mt-4 text-xs text-ink-secondary">
          Plataformas: comissão {p.platformCommissionPct}% + IVA {p.platformCommissionVatPct}% · IVA das vendas {p.deliverySalesVatPct}%
          {p.source === "inherited" ? " (herdados do mês anterior)" : p.source === "default" ? " (valores de omissão)" : ""}. Gastos pelo extrato
          bancário, no mês da fatura: com fatura conciliada, a categoria e a data da fatura; sem fatura, a classificação do extrato e a
          data do pagamento.
        </p>
      )}
    </section>
  );
}

function VatLine({ label, amount, hint }: { label: string; amount: number | null; hint?: string }) {
  return (
    <div className={ROW}>
      <span className="min-w-0 text-sm text-ink">
        {label}
        {hint && <span className="block text-xs text-ink-secondary">{hint}</span>}
      </span>
      {amount === null ? <Pending /> : <span className={`${AMOUNT} text-ink`}>{euros(amount)}</span>}
    </div>
  );
}

function SidePanel({ statement, costs }: { statement: DreStatement; costs: DreReport | null }) {
  const confidence = costs ? dreConfidencePct(costs) : null;
  const expenses = costs?.expenses;
  return (
    <aside className={`${SURFACE} flex flex-col gap-5 p-6`}>
      <section aria-labelledby="dre-vat">
        <h2 id="dre-vat" className={SECTION_TITLE}>
          IVA do mês
        </h2>
        <div className="mt-2 divide-y divide-line-subtle">
          <VatLine label="IVA das vendas" amount={statement.vatSalesCents} />
          <VatLine
            label="IVA das compras"
            amount={costs ? costs.vat.purchasesCents : null}
            hint={costs && costs.vat.purchasesEstimatedCents > 0 ? `Dedutível · ${euros(costs.vat.purchasesEstimatedCents)} estimado` : "Dedutível conhecido"}
          />
          <div className={ROW}>
            <span className="text-sm font-semibold text-navy-900">
              {statement.vatBalanceCents !== null && statement.vatBalanceCents < 0 ? "A recuperar (estimativa)" : "A entregar (estimativa)"}
            </span>
            {statement.vatBalanceCents === null ? <Pending /> : <span className="text-sm font-semibold tabular-nums text-navy-900">{euros(Math.abs(statement.vatBalanceCents))}</span>}
          </div>
        </div>
      </section>

      <div className="border-t border-line-subtle" />

      <section aria-labelledby="dre-confidence">
        <h2 id="dre-confidence" className={SECTION_TITLE}>
          Confiança dos gastos
        </h2>
        {!expenses ? (
          <Pending className="mt-2 h-24 w-full" />
        ) : confidence === null ? (
          <p className="mt-2 text-sm text-ink-secondary">Sem gastos neste período.</p>
        ) : (
          <>
            <p className="mt-2 text-3xl font-bold tabular-nums text-navy-900">{confidence}%</p>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-soft" role="progressbar" aria-valuenow={confidence} aria-valuemin={0} aria-valuemax={100} aria-label="Confiança dos gastos">
              <div className={`h-full rounded-full ${confidence >= 90 ? "bg-emerald-600" : confidence >= 60 ? "bg-amber-500" : "bg-rose-600"}`} style={{ width: `${confidence}%` }} />
            </div>
            <p className="mt-2 text-xs text-ink-secondary">Gastos com categoria e IVA conhecido.</p>
            <ul className="mt-3 space-y-1.5 text-sm">
              {expenses.estimatedVatCents > 0 && (
                <li className="flex justify-between gap-3">
                  <span className="text-ink">IVA estimado (média das faturas / teórico)</span>
                  <span className="tabular-nums text-ink">{euros(expenses.estimatedVatCents)}</span>
                </li>
              )}
              <li className="flex justify-between gap-3">
                <span className="text-ink">IVA por confirmar</span>
                <span className="tabular-nums text-ink">{euros(expenses.pendingVatCents)}</span>
              </li>
              <li className="flex justify-between gap-3">
                <span className="text-ink">Sem fatura (classificação do extrato)</span>
                <span className="tabular-nums text-ink">{euros(expenses.unclassifiedCents)}</span>
              </li>
            </ul>
            {(expenses.pendingVatCents > 0 || expenses.unclassifiedCents > 0) && (
              <Link
                to="/financial/bank-statements"
                className="mt-4 flex items-center justify-between rounded-xl border border-line px-4 py-3 text-sm text-navy-900 transition-colors duration-150 hover:bg-surface-soft"
              >
                <span>Conciliar com as faturas</span>
                <span className="text-xs font-medium text-brand-600">Conciliar</span>
              </Link>
            )}
          </>
        )}
      </section>
    </aside>
  );
}

function Kpi({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="self-end">
      <p className="text-xs text-ink-secondary">{label}</p>
      {value === null ? (
        <Pending className="mt-1 h-6 w-24" />
      ) : (
        <p className={`text-lg font-semibold tabular-nums ${value < 0 ? "text-rose-600" : "text-navy-900"}`}>{euros(value)}</p>
      )}
    </div>
  );
}

/** DRE do mês pela conciliação bancária (Mapa de rentabilidade → Mapa). */
export function DreView({ year, month }: { year: number; month: number }) {
  const { costs, sales, costsLoading, salesLoading, costsError, salesError, future } = useDre(year, month);
  const [paramsOpen, setParamsOpen] = useState(false);
  const [payments, setPayments] = useState<DrePaymentsTarget | null>(null);
  const canSeePayments = useCanSeePayments();
  const openPayments = (line: StatementLine) =>
    line.entriesSection && setPayments({ section: line.entriesSection, title: line.label, labels: new Map(line.children.map((c) => [c.key, c.label])) });
  const statement = composeDreStatement(costs, sales, { platform: platformLabel, movementKind: kindLabel, euros });
  const period = costs?.period ?? sales?.period ?? null;

  return (
    <div className={`${PAGE_BG} mx-auto w-full max-w-6xl space-y-5 p-4 sm:p-6`}>
      {!future && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setParamsOpen(true)}>
            Parâmetros do mês
          </Button>
          <DreParametersDrawer year={year} month={month} open={paramsOpen} onClose={() => setParamsOpen(false)} />
        </div>
      )}
      {future ? (
        <EmptyState title="Este mês ainda não começou" description="Escolha um mês até ao atual." />
      ) : (
        <>
          {salesLoading && (
            <AlertBanner tone="info" title="As vendas do restaurante estão a carregar">
              O resto da DRE já aparece à medida que chega; as vendas do Vendus completam a receita e o resultado. Se for a primeira vez
              que abre este mês, demora um pouco mais do que o normal (até cerca de um minuto).
            </AlertBanner>
          )}
          {costsLoading && <AlertBanner tone="info" title="Os custos do banco estão a carregar">Aparecem dentro de segundos.</AlertBanner>}
          {salesError && (
            <AlertBanner tone="warning" title="Não foi possível carregar as vendas do restaurante">
              {salesError}
            </AlertBanner>
          )}
          {costsError && (
            <AlertBanner tone="danger" title="Não foi possível carregar os custos do banco">
              {costsError}
            </AlertBanner>
          )}
          <section className={`${SURFACE} grid gap-6 p-6 sm:grid-cols-4`}>
            <div className="sm:col-span-1">
              <h2 className={`${SECTION_TITLE} first-letter:uppercase`}>{monthName(month)}</h2>
              <p className="mt-3 text-sm text-ink-secondary">Lucro líquido da operação</p>
              {statement.netResultCents === null ? (
                <Pending className="mt-1 h-10 w-40" />
              ) : (
                <p className={`text-4xl font-bold tracking-tight tabular-nums ${statement.netResultCents < 0 ? "text-rose-600" : "text-navy-900"}`}>
                  {euros(statement.netResultCents)}
                </p>
              )}
              {statement.netMarginPct !== null && (
                <p className="mt-1 text-xs text-ink-secondary">
                  Margem <span className="font-semibold tabular-nums text-navy-900">{Math.round(statement.netMarginPct)}%</span>
                  {period?.isCurrentMonth && <span> · até hoje</span>}
                </p>
              )}
            </div>
            <Kpi label="Receita líquida" value={statement.netRevenueCents} />
            <Kpi label="Lucro bruto" value={statement.grossProfitCents} />
            <Kpi label="Resultado operacional" value={statement.operatingResultCents} />
          </section>
          <div className="grid gap-5 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <Statement statement={statement} costs={costs} onPayments={canSeePayments ? openPayments : undefined} />
              <DrePaymentsDrawer year={year} month={month} target={payments} onClose={() => setPayments(null)} />
            </div>
            <SidePanel statement={statement} costs={costs} />
          </div>
        </>
      )}
    </div>
  );
}
