import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  AlertBanner,
  EmptyState,
  IconChevronDown,
  PAGE_BG,
  SECTION_TITLE,
  SURFACE,
  Skeleton,
  StatusBadge,
} from "../../../../components/ui/index.ts";
import type { DreExpenseCategory, DreReport } from "../../domain/entities/dre.ts";
import { monthName } from "../../domain/services/cash-flow-view.ts";
import { dreConfidencePct, platformLabel } from "../../domain/services/dre-view.ts";
import { euros, kindLabel } from "./cash-flow-format.ts";
import { useDre } from "./use-dre.ts";
import { useOptionalAuth } from "../../../../contexts/AuthContext";
import { canOpenPath } from "../../../access/domain/services/access-ui.service.ts";

const ROW = "flex items-baseline justify-between gap-4 py-2.5";
const AMOUNT = "shrink-0 text-sm tabular-nums";

function Line({ label, amount, strong = false, negative = false, hint }: { label: ReactNode; amount: number; strong?: boolean; negative?: boolean; hint?: ReactNode }) {
  return (
    <div className={ROW}>
      <span className={`min-w-0 ${strong ? "text-sm font-semibold text-navy-900" : "text-sm text-ink"}`}>
        {label}
        {hint && <span className="block text-xs font-normal text-ink-secondary">{hint}</span>}
      </span>
      <span className={`${AMOUNT} ${strong ? "font-semibold text-navy-900" : "text-ink"}`}>{negative && amount !== 0 ? `− ${euros(amount)}` : euros(amount)}</span>
    </div>
  );
}

const categoryName = (c: DreExpenseCategory) => (c.type === "group" ? (c.name ?? "Sem nome") : kindLabel(c.movementKind));

function ExpenseRow({ category }: { category: DreExpenseCategory }) {
  const [open, setOpen] = useState(false);
  const expandable = category.children.length > 0;
  return (
    <li>
      <button
        type="button"
        className={`${ROW} w-full text-left disabled:cursor-default`}
        onClick={() => setOpen(!open)}
        disabled={!expandable}
        aria-expanded={expandable ? open : undefined}
      >
        <span className="flex min-w-0 flex-wrap items-center gap-2 pl-3 text-sm text-ink">
          <span>{categoryName(category)}</span>
          {category.type === "unclassified" && <StatusBadge tone="warning">Por classificar</StatusBadge>}
          {category.type === "group" && category.pendingVatCents > 0 && (
            <StatusBadge tone="neutral">IVA por confirmar {euros(category.pendingVatCents)}</StatusBadge>
          )}
          {expandable && <IconChevronDown size={14} className={`text-ink-muted transition-transform ${open ? "rotate-180" : ""}`} />}
        </span>
        <span className={`${AMOUNT} text-ink`}>− {euros(category.netCents)}</span>
      </button>
      {open && (
        <ul className="mb-2 ml-6 space-y-1.5 border-l border-line-subtle pl-3">
          {category.children.map((ch) => (
            <li key={ch.key} className="flex items-baseline justify-between gap-3 text-xs">
              <span className="text-ink-secondary">{ch.name ?? "Sem subcategoria"}</span>
              <span className="tabular-nums text-ink">− {euros(ch.netCents)}</span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

/** Onde se lançam os ajustes manuais (páginas que saíram do menu); só as que a pessoa pode abrir. */
function AdjustmentLinks() {
  const user = useOptionalAuth()?.user;
  const access = user?.access;
  const links = [
    { to: "/dre/custos-fixos", label: "Custos fixos" },
    { to: "/dre/custos-variaveis", label: "Custos variáveis" },
  ].filter((l) => !access || canOpenPath({ isAdmin: access.isAdmin, portalOnly: access.portalOnly, permissions: { ...access.permissions } }, l.to));
  return (
    <>
      Custos lançados à mão
      {links.length > 0 && " · lançar: "}
      {links.map((l, i) => (
        <span key={l.to}>
          {i > 0 && " · "}
          <Link to={l.to} className="font-medium text-ink-secondary underline-offset-2 hover:text-navy-900 hover:underline">
            {l.label}
          </Link>
        </span>
      ))}
    </>
  );
}

/** Demonstração de resultados: receita, gastos por categoria, ajustes manuais e resultado. */
function Statement({ report }: { report: DreReport }) {
  const { revenue, expenses, manualAdjustments } = report;
  return (
    <section className={`${SURFACE} p-6`} aria-labelledby="dre-statement">
      <h2 id="dre-statement" className={SECTION_TITLE}>
        Demonstração de resultados <span className="font-normal text-ink-secondary">· sem IVA</span>
      </h2>

      <div className="mt-3 divide-y divide-line-subtle">
        <div>
          <Line label="Receita" amount={revenue.totalNetCents} strong />
          <div className="pl-3">
            <Line label="Restaurante" amount={revenue.restaurantNetCents} hint="Vendas do Vendus" />
            <Line
              label="Plataformas de entrega"
              amount={revenue.platformsNetCents}
              hint={
                revenue.platformsVatKnown
                  ? `Recebido no banco, já sem comissão · vendido ${euros(revenue.platformsSoldNetCents)} · comissões e acertos ≈ ${euros(revenue.platformsCommissionEstimateCents)}`
                  : "Recebido no banco pelo valor total (sem vendas do AirMenu para tirar o IVA)"
              }
            />
            {revenue.byPlatform.map((p) => (
              <div key={p.platform} className="flex items-baseline justify-between gap-4 py-1 pl-3 text-xs text-ink-secondary">
                <span>{platformLabel(p.platform)}</span>
                <span className="tabular-nums">{euros(p.netCents)}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <Line label="Gastos" amount={expenses.totalNetCents} strong negative />
          {expenses.categories.length === 0 ? (
            <p className="pb-2.5 pl-3 text-sm text-ink-secondary">Sem saídas no banco neste período.</p>
          ) : (
            <ul>
              {expenses.categories.map((c) => (
                <ExpenseRow key={c.key} category={c} />
              ))}
            </ul>
          )}
        </div>

        {/* Menu V1: Custos fixos e variáveis saíram do menu — lançam-se a partir daqui. */}
        <div>
          <Line label="Ajustes manuais" amount={manualAdjustments.totalCents} strong negative hint={<AdjustmentLinks />} />
          <div className="pl-3">
            {manualAdjustments.fixedCents !== 0 && <Line label="Custos fixos" amount={manualAdjustments.fixedCents} negative />}
            {manualAdjustments.variableCents !== 0 && <Line label="Custos variáveis" amount={manualAdjustments.variableCents} negative />}
          </div>
        </div>

        <div className={`${ROW} pt-4`}>
          <span className="text-base font-semibold text-navy-900">Resultado</span>
          <span className={`text-base font-semibold tabular-nums ${report.resultCents < 0 ? "text-rose-600" : "text-navy-900"}`}>
            {euros(report.resultCents)}
          </span>
        </div>
      </div>
    </section>
  );
}

function SidePanel({ report }: { report: DreReport }) {
  const { vat, expenses } = report;
  const confidence = dreConfidencePct(report);
  return (
    <aside className={`${SURFACE} flex flex-col gap-5 p-6`}>
      <section aria-labelledby="dre-vat">
        <h2 id="dre-vat" className={SECTION_TITLE}>
          IVA do mês
        </h2>
        <div className="mt-2 divide-y divide-line-subtle">
          <Line label="IVA das vendas" amount={vat.salesCents} />
          <Line label="IVA das compras" amount={vat.purchasesCents} negative hint="Dedutível conhecido" />
          <div className={ROW}>
            <span className="text-sm font-semibold text-navy-900">{vat.balanceCents >= 0 ? "A entregar (estimativa)" : "A recuperar (estimativa)"}</span>
            <span className="text-sm font-semibold tabular-nums text-navy-900">{euros(Math.abs(vat.balanceCents))}</span>
          </div>
        </div>
      </section>

      <div className="border-t border-line-subtle" />

      <section aria-labelledby="dre-confidence">
        <h2 id="dre-confidence" className={SECTION_TITLE}>
          Confiança dos gastos
        </h2>
        {confidence === null ? (
          <p className="mt-2 text-sm text-ink-secondary">Sem gastos neste período.</p>
        ) : (
          <>
            <p className="mt-2 text-3xl font-bold tabular-nums text-navy-900">{confidence}%</p>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-soft" role="progressbar" aria-valuenow={confidence} aria-valuemin={0} aria-valuemax={100} aria-label="Confiança dos gastos">
              <div className={`h-full rounded-full ${confidence >= 90 ? "bg-emerald-600" : confidence >= 60 ? "bg-amber-500" : "bg-rose-600"}`} style={{ width: `${confidence}%` }} />
            </div>
            <p className="mt-2 text-xs text-ink-secondary">Gastos com categoria e IVA conhecido.</p>
            <ul className="mt-3 space-y-1.5 text-sm">
              <li className="flex justify-between gap-3">
                <span className="text-ink">IVA por confirmar</span>
                <span className="tabular-nums text-ink">{euros(expenses.pendingVatCents)}</span>
              </li>
              <li className="flex justify-between gap-3">
                <span className="text-ink">Por classificar</span>
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

/** DRE do mês pela conciliação bancária (Mapa de rentabilidade → Mapa). */
export function DreView({ year, month }: { year: number; month: number }) {
  const { report, loading, error, future } = useDre(year, month);

  return (
    <div className={`${PAGE_BG} mx-auto w-full max-w-6xl space-y-5 p-4 sm:p-6`}>
      {future ? (
        <EmptyState title="Este mês ainda não começou" description="Escolha um mês até ao atual." />
      ) : error ? (
        <AlertBanner tone="danger" title="Não foi possível carregar a DRE">
          {error}
        </AlertBanner>
      ) : loading || !report ? (
        <div className="grid gap-5 lg:grid-cols-3" aria-busy="true">
          <Skeleton className="h-40 lg:col-span-3" />
          <Skeleton className="h-[28rem] lg:col-span-2" />
          <Skeleton className="h-[28rem]" />
        </div>
      ) : (
        <>
          <section className={`${SURFACE} grid gap-6 p-6 sm:grid-cols-4`}>
            <div className="sm:col-span-1">
              <h2 className={`${SECTION_TITLE} first-letter:uppercase`}>{monthName(report.period.month)}</h2>
              <p className="mt-3 text-sm text-ink-secondary">Resultado</p>
              <p className={`text-4xl font-bold tracking-tight tabular-nums ${report.resultCents < 0 ? "text-rose-600" : "text-navy-900"}`}>{euros(report.resultCents)}</p>
              {report.marginPct !== null && (
                <p className="mt-1 text-xs text-ink-secondary">
                  Margem <span className="font-semibold tabular-nums text-navy-900">{Math.round(report.marginPct)}%</span>
                  {report.period.isCurrentMonth && <span> · até hoje</span>}
                </p>
              )}
            </div>
            {[
              { label: "Receita", value: report.revenue.totalNetCents },
              { label: "Gastos", value: report.expenses.totalNetCents },
              { label: "Ajustes manuais", value: report.manualAdjustments.totalCents },
            ].map((k) => (
              <div key={k.label} className="self-end">
                <p className="text-xs text-ink-secondary">{k.label}</p>
                <p className="text-lg font-semibold tabular-nums text-navy-900">{euros(k.value)}</p>
              </div>
            ))}
          </section>
          <div className="grid gap-5 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <Statement report={report} />
            </div>
            <SidePanel report={report} />
          </div>
        </>
      )}
    </div>
  );
}
