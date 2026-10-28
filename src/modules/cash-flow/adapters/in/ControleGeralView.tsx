import { useState } from "react";
import { Link } from "react-router-dom";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { AlertBanner, EmptyState, PAGE_BG, SECTION_TITLE, SURFACE, Skeleton } from "../../../../components/ui/index.ts";
import { useOptionalAuth } from "../../../../contexts/AuthContext";
import { hasLevel } from "../../../access/domain/services/access-ui.service.ts";
import { monthName } from "../../domain/services/cash-flow-view.ts";
import { composeControleGeral, type ExpenseGroup, type ExpenseGroupKey } from "../../domain/services/controle-geral.ts";
import { euros, kindLabel } from "./cash-flow-format.ts";
import { DrePaymentsDrawer, type DrePaymentsTarget } from "./DrePaymentsDrawer.tsx";
import { useDre } from "./use-dre.ts";

/**
 * Cores dos grupos, por ordem fixa (paleta categórica validada: lightness, croma e separação para
 * daltonismo; o contraste baixo de algumas é compensado pela tabela ao lado). recharts não aceita classes.
 */
const GROUP_COLORS: Record<ExpenseGroupKey, string> = {
  DC: "#2a78d6",
  DF: "#eb6834",
  DV: "#1baf7a",
  DP: "#eda100",
  DI: "#e87ba4",
  DIVA: "#008300",
  DE: "#6250d6",
};

const pctText = (p: number | null) => (p === null ? "—" : `${p.toLocaleString("pt-PT", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`);

/** Vê os pagamentos (descritivo do extrato) — Admin ou «Bancos & conciliação», como na DRE. */
function useCanSeePayments(): boolean {
  const access = useOptionalAuth()?.user?.access;
  return !!access && !access.portalOnly && (access.isAdmin || hasLevel(access.permissions, "finance.banking", "READ"));
}

function Value({ cents, strong, tone }: { cents: number | null; strong?: boolean; tone?: "negative-red" }) {
  if (cents === null) return <Skeleton className="ml-auto h-4 w-20" />;
  const red = tone === "negative-red" && cents < 0;
  return <span className={`tabular-nums ${strong ? "font-semibold" : ""} ${red ? "text-rose-600" : "text-ink"}`}>{euros(cents)}</span>;
}

function GroupRow({ g, onOpen }: { g: ExpenseGroup; onOpen?: () => void }) {
  const label = (
    <span className="flex items-center gap-2">
      <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: GROUP_COLORS[g.key] }} aria-hidden />
      <span className="font-semibold text-navy-900">{g.key}</span>
      <span className="text-ink-secondary">{g.name}</span>
    </span>
  );
  return (
    <tr className="border-b border-line-subtle last:border-0">
      <td className="py-2 pr-3 text-sm">
        {onOpen ? (
          <button type="button" className="text-left hover:underline" onClick={onOpen} aria-label={`Ver pagamentos — ${g.key} ${g.name}`}>
            {label}
          </button>
        ) : (
          label
        )}
        {g.parts.length > 0 && <span className="mt-0.5 block pl-[18px] text-xs text-ink-secondary">{g.parts.map((p) => p.label).join(" · ")}</span>}
      </td>
      <td className="py-2 text-right text-sm">
        <Value cents={g.amountCents} />
      </td>
      <td className="w-16 py-2 text-right text-xs tabular-nums text-ink-secondary">{pctText(g.pctOfTotal)}</td>
    </tr>
  );
}

function SummaryRow({ label, cents, pct, strong, tone }: { label: string; cents: number | null; pct?: number | null; strong?: boolean; tone?: "negative-red" }) {
  return (
    <tr className="border-b border-line-subtle last:border-0">
      <td className={`py-2 pr-3 text-sm ${strong ? "font-semibold text-navy-900" : "text-ink"}`}>{label}</td>
      <td className="py-2 text-right text-sm">
        <Value cents={cents} strong={strong} tone={tone} />
      </td>
      <td className="w-16 py-2 text-right text-xs tabular-nums text-ink-secondary">{pct === undefined ? "" : pctText(pct)}</td>
    </tr>
  );
}

/** Gráfico circular das despesas por grupo, com legenda e rótulos de % (a tabela ao lado tem os valores). */
function GroupsDonut({ groups }: { groups: ExpenseGroup[] }) {
  const data = groups.filter((g) => (g.amountCents ?? 0) > 0).map((g) => ({ key: g.key, name: `${g.key} — ${g.name}`, value: g.amountCents!, pct: g.pctOfTotal }));
  if (data.length === 0) return <p className="text-sm text-ink-secondary">Sem despesas neste mês.</p>;
  return (
    <div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius="52%"
              outerRadius="92%"
              stroke="var(--color-surface-card, #fff)"
              strokeWidth={2}
              isAnimationActive={false}
              label={({ payload }: { payload?: { pct: number | null } }) => (payload && payload.pct !== null && payload.pct >= 4 ? pctText(payload.pct) : "")}
              labelLine={false}
            >
              {data.map((d) => (
                <Cell key={d.key} fill={GROUP_COLORS[d.key]} />
              ))}
            </Pie>
            <Tooltip formatter={(v: number, _n, item) => [`${euros(v)} · ${pctText((item.payload as { pct: number | null }).pct)}`, (item.payload as { name: string }).name]} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-ink-secondary">
        {data.map((d) => (
          <li key={d.key} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: GROUP_COLORS[d.key] }} aria-hidden />
            {d.key} <span className="tabular-nums">{pctText(d.pct)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Mapa de rentabilidade → Controle geral (aberto a partir da DRE): despesas por grupo (DC, DF, DV, DP,
 * DI, DIVA, DE) com o gráfico, o IVA e o resumo do mês, no modelo da folha do utilizador. Cada grupo com
 * pagamentos no banco abre a mesma lista de pagamentos da DRE.
 */
export function ControleGeralView({ year, month }: { year: number; month: number }) {
  const { costs, sales, costsError, salesError, future } = useDre(year, month);
  const canSeePayments = useCanSeePayments();
  const [payments, setPayments] = useState<DrePaymentsTarget | null>(null);
  const cg = composeControleGeral(costs, sales);

  const labels = new Map<string, string>(
    (costs?.expenses.sections ?? []).flatMap((s) => s.items.map((i) => [i.key, i.name ?? kindLabel(i.movementKind)] as [string, string])),
  );
  const open = (g: ExpenseGroup) => setPayments({ section: g.sections, title: `${g.key} — ${g.name}`, labels });
  const canOpen = (g: ExpenseGroup) => canSeePayments && g.sections.some((k) => costs?.expenses.sections.some((s) => s.key === k && s.netCents !== 0));

  return (
    <div className={`${PAGE_BG} mx-auto w-full max-w-6xl space-y-5 p-4 sm:p-6`}>
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="text-lg font-semibold text-navy-900">
          Controle geral <span className="font-normal text-ink-secondary first-letter:uppercase">· {monthName(month)} {year}</span>
        </h1>
        <Link to="/dre/demonstrativo" className="text-sm font-medium text-ink-secondary hover:text-navy-900">
          ← Voltar à DRE
        </Link>
      </div>
      {future ? (
        <EmptyState title="Este mês ainda não começou" description="Escolha um mês até ao atual." />
      ) : (
        <>
          {(costsError || salesError) && (
            <AlertBanner tone="danger" title="Não foi possível carregar a DRE do mês">
              {costsError ?? salesError}
            </AlertBanner>
          )}
          <div className="grid gap-5 lg:grid-cols-5">
            <div className="space-y-5 lg:col-span-3">
              <section className={`${SURFACE} p-6`} aria-labelledby="cg-groups">
                <h2 id="cg-groups" className={SECTION_TITLE}>
                  Despesas por grupo <span className="font-normal text-ink-secondary">· com IVA</span>
                </h2>
                <table className="mt-3 w-full">
                  <thead>
                    <tr className="border-b border-line-subtle text-xs text-ink-secondary">
                      <th className="py-2 text-left font-medium">Categoria</th>
                      <th className="py-2 text-right font-medium">€</th>
                      <th className="py-2 text-right font-medium">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cg.groups.map((g) => (
                      <GroupRow key={g.key} g={g} onOpen={canOpen(g) ? () => open(g) : undefined} />
                    ))}
                    <SummaryRow label="Total" cents={cg.totalCents} pct={cg.totalCents === null ? null : 100} strong />
                  </tbody>
                </table>
              </section>

              <section className={`${SURFACE} p-6`} aria-labelledby="cg-vat">
                <h2 id="cg-vat" className={SECTION_TITLE}>
                  IVA
                </h2>
                <table className="mt-3 w-full">
                  <tbody>
                    <SummaryRow label="IVA das vendas" cents={cg.vat.salesCents} />
                    <SummaryRow
                      label="IVA a reduzir (dedutível)"
                      cents={cg.vat.deductibleCents}
                      pct={cg.vat.salesCents && cg.vat.deductibleCents !== null ? (cg.vat.deductibleCents / cg.vat.salesCents) * 100 : null}
                    />
                    <SummaryRow
                      label={cg.vat.payableCents !== null && cg.vat.payableCents < 0 ? "Crédito de IVA" : "IVA a pagar"}
                      cents={cg.vat.payableCents === null ? null : Math.abs(cg.vat.payableCents)}
                      pct={cg.vat.salesCents && cg.vat.payableCents !== null ? (Math.abs(cg.vat.payableCents) / cg.vat.salesCents) * 100 : null}
                      strong
                    />
                  </tbody>
                </table>
                <p className="mt-2 text-xs text-ink-secondary">% sobre o IVA das vendas.</p>
              </section>

              <section className={`${SURFACE} p-6`} aria-labelledby="cg-summary">
                <h2 id="cg-summary" className={SECTION_TITLE}>
                  Resumo
                </h2>
                <table className="mt-3 w-full">
                  <tbody>
                    <SummaryRow label="Faturação (com IVA)" cents={cg.invoicingCents} />
                    <SummaryRow
                      label="Despesas totais"
                      cents={cg.totalCents}
                      pct={cg.totalCents === null || !cg.invoicingCents ? null : (cg.totalCents / cg.invoicingCents) * 100}
                    />
                    <SummaryRow
                      label="Despesas totais − IVA a reduzir"
                      cents={cg.totalLessDeductibleCents}
                      pct={cg.totalLessDeductibleCents === null || !cg.invoicingCents ? null : (cg.totalLessDeductibleCents / cg.invoicingCents) * 100}
                    />
                    <SummaryRow
                      label={
                        cg.variableRent.pct > 0
                          ? `Variável renda (${cg.variableRent.pct.toLocaleString("pt-PT")}% acima de ${euros(cg.variableRent.thresholdCents)})`
                          : "Variável renda (sem renda variável nos parâmetros)"
                      }
                      cents={cg.variableRent.cents}
                    />
                    <SummaryRow label="Saldo" cents={cg.balanceCents} strong tone="negative-red" />
                    <tr>
                      <td className="py-2 pr-3 text-sm font-semibold text-navy-900">Margem de lucro</td>
                      <td className={`py-2 text-right text-sm font-semibold tabular-nums ${cg.marginPct !== null && cg.marginPct < 0 ? "text-rose-600" : "text-navy-900"}`}>
                        {cg.balanceCents === null ? <Skeleton className="ml-auto h-4 w-12" /> : pctText(cg.marginPct)}
                      </td>
                      <td />
                    </tr>
                  </tbody>
                </table>
                <p className="mt-2 text-xs text-ink-secondary">
                  % sobre a faturação. Saldo = faturação − (despesas − IVA a reduzir) − variável renda (≈ lucro líquido da DRE − empréstimos − renda variável). Os grupos são uma proposta, a rever.
                </p>
              </section>
            </div>
            <section className={`${SURFACE} p-6 lg:col-span-2`} aria-labelledby="cg-chart">
              <h2 id="cg-chart" className={SECTION_TITLE}>
                Despesas do mês
              </h2>
              <div className="mt-3">{cg.totalCents === null ? <Skeleton className="h-64" /> : <GroupsDonut groups={cg.groups} />}</div>
            </section>
          </div>
          <DrePaymentsDrawer year={year} month={month} target={payments} onClose={() => setPayments(null)} />
        </>
      )}
    </div>
  );
}

