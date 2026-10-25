import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useFinancialBaseModule } from "../../financial-base.module.tsx";
import { formatEUR, formatIsoDatePt } from "../../../../lib/format.ts";
import { AppIcon, BRAND, FIELD, NUMERIC, SURFACE } from "../../../../components/ui/index.ts";
import type { SupplierPlanningSummary as Summary } from "../../domain/entities/supplier.ts";
import { frequencyLabel, priceSeries } from "../../domain/services/supplier-planning.ts";
import { supplierInitials } from "../../domain/services/supplier-initials.ts";

const AXIS_TICK = { fontSize: 11, fill: BRAND.navy, fillOpacity: 0.55 };
const PERIODS = [
  { months: 3, label: "Últimos 3 meses" },
  { months: 6, label: "Últimos 6 meses" },
  { months: 12, label: "Últimos 12 meses" },
];
const RECENT_ITEMS = 5;

const priceLabel = (price: number, unit: string) => `${formatEUR(price)} / ${unit}`;

function SectionTitle({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <header className="flex items-start justify-between gap-3 px-5 pt-4">
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-navy-900">{title}</h2>
        {subtitle && <p className="mt-0.5 text-[13px] text-ink-secondary">{subtitle}</p>}
      </div>
      {action && <div className="-my-1 shrink-0">{action}</div>}
    </header>
  );
}

function Kpi({ icon, value, label }: { icon: ReactNode; value: string; label: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-line px-4 py-3">
      <span className="mt-0.5 shrink-0 text-brand-600">{icon}</span>
      <div className="min-w-0">
        <p className={`text-xl font-bold text-navy-900 ${NUMERIC}`}>{value}</p>
        <p className="mt-0.5 text-[13px] leading-snug text-ink-secondary">{label}</p>
      </div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="px-5 pb-5 pt-3 text-sm text-ink-muted">{text}</p>;
}

function SummaryCard({ s }: { s: Summary }) {
  return (
    <section className={SURFACE}>
      <SectionTitle title="Resumo no planeamento" subtitle="Como este fornecedor é utilizado nas recomendações de compra." />
      <div className="grid gap-3 p-5 sm:grid-cols-3">
        <Kpi icon={<AppIcon name="stock" size={22} />} value={String(s.associatedItems)} label="Itens associados com histórico de compra (12 meses)" />
        <Kpi icon={<AppIcon name="financial" size={22} />} value={formatEUR(s.purchasesLast3Months)} label="Compras s/ IVA (últimos 3 meses)" />
        <Kpi
          icon={<AppIcon name="profitability" size={22} />}
          value={frequencyLabel(s.purchaseFrequencyDays)}
          label={s.purchaseFrequencyDays === null ? "Frequência de compra (precisa de duas faturas em 12 meses)" : "Frequência de compra (média entre faturas)"}
        />
      </div>
    </section>
  );
}

function CategoriesCard({ s }: { s: Summary }) {
  return (
    <section className={SURFACE}>
      <SectionTitle title="Categorias mais compradas" subtitle="Subcategorias pelo valor s/ IVA, últimos 12 meses" />
      {s.categories.length === 0 ? (
        <Empty text="Sem faturas lançadas nos últimos 12 meses." />
      ) : (
        <ul className="space-y-2.5 px-5 pb-5 pt-4">
          {s.categories.map((c) => (
            <li key={c.name} className="grid grid-cols-[minmax(0,9rem)_1fr_3rem] items-center gap-3 text-sm" title={formatEUR(c.amount)}>
              <span className="truncate text-ink">{c.name}</span>
              <span className="h-2.5 overflow-hidden rounded-full bg-surface-soft">
                <span className="block h-full rounded-full bg-brand-600" style={{ width: `${Math.max(c.pct, 2)}%` }} />
              </span>
              <span className={`text-right text-ink-secondary ${NUMERIC}`}>{c.pct}%</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function PriceEvolutionCard({ s }: { s: Summary }) {
  const [itemId, setItemId] = useState<string | null>(null);
  const [months, setMonths] = useState(6);
  const item = s.items.find((i) => i.stockItemId === (itemId ?? s.defaultItemId)) ?? s.items[0];
  const data = useMemo(() => (item ? priceSeries(item.monthly, months, new Date()) : []), [item, months]);
  const hasPoints = data.some((p) => p.price !== null);

  return (
    <section className={SURFACE}>
      <SectionTitle
        title="Evolução de preços (média por mês)"
        subtitle={item ? `${item.name} — preço s/ IVA por ${item.priceUnit}` : undefined}
        action={
          <select value={months} onChange={(e) => setMonths(Number(e.target.value))} aria-label="Período" className={`${FIELD} h-9 pr-8`}>
            {PERIODS.map((p) => (
              <option key={p.months} value={p.months}>{p.label}</option>
            ))}
          </select>
        }
      />
      {!item ? (
        <Empty text="Ainda não há compras deste fornecedor conciliadas com artigos de stock." />
      ) : (
        <>
          <div className="px-5 pt-3">
            <select value={item.stockItemId} onChange={(e) => setItemId(e.target.value)} aria-label="Artigo" className={`${FIELD} h-9 w-full pr-8 sm:w-72`}>
              {s.items.map((i) => (
                <option key={i.stockItemId} value={i.stockItemId}>{i.name}</option>
              ))}
            </select>
          </div>
          {hasPoints ? (
            <div className="h-[220px] px-2 pb-3 pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 4 }}>
                  <CartesianGrid vertical={false} stroke={BRAND.border} />
                  <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} interval={0} />
                  <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={64} tickFormatter={(v: number) => formatEUR(v)} />
                  <Tooltip
                    formatter={(v) => [priceLabel(Number(v), item.priceUnit), "Preço médio"]}
                    contentStyle={{ borderRadius: 12, borderColor: BRAND.border, fontSize: 12 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="price"
                    stroke={BRAND.primary}
                    strokeWidth={2.25}
                    fill={BRAND.primarySoft}
                    fillOpacity={0.7}
                    connectNulls
                    dot={{ r: 3, fill: BRAND.primary, strokeWidth: 0 }}
                    activeDot={{ r: 5 }}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <Empty text="Sem compras deste artigo no período escolhido." />
          )}
        </>
      )}
    </section>
  );
}

function RecentItemsCard({ s, onOpenItems }: { s: Summary; onOpenItems: () => void }) {
  return (
    <section className={SURFACE}>
      <SectionTitle
        title="Itens recentes deste fornecedor"
        action={
          <button type="button" onClick={onOpenItems} className="text-sm font-medium text-brand-600 hover:text-brand-500">
            Ver todos
          </button>
        }
      />
      {s.items.length === 0 ? (
        <Empty text="Ainda não há compras deste fornecedor conciliadas com artigos de stock." />
      ) : (
        <div className="px-5 pb-5 pt-3">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-ink-secondary">
                <th className="py-2 font-medium">Item</th>
                <th className="py-2 font-medium">Última compra</th>
                <th className="py-2 text-right font-medium">Preço unitário</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-subtle">
              {s.items.slice(0, RECENT_ITEMS).map((i) => (
                <tr key={i.stockItemId}>
                  <td className="py-2.5">
                    <span className="flex items-center gap-3">
                      <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-surface-soft text-[11px] font-semibold text-ink-secondary">
                        {supplierInitials(i.name)}
                      </span>
                      <span className="truncate text-ink">{i.name}</span>
                    </span>
                  </td>
                  <td className={`py-2.5 text-ink-secondary ${NUMERIC}`}>{formatIsoDatePt(i.lastPurchaseDate)}</td>
                  <td className={`py-2.5 text-right text-ink ${NUMERIC}`}>{priceLabel(i.lastUnitPrice, i.priceUnit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/**
 * «Resumo no planeamento» (mockup do utilizador, separador Abastecimento): itens comprados, compras dos
 * últimos 3 meses, frequência de compra (não há encomendas registadas para medir prazos reais),
 * subcategorias mais compradas, evolução do preço de um artigo e itens recentes.
 */
export function SupplierPlanningSummary({ supplierId, onOpenItems }: { supplierId: string; onOpenItems: () => void }) {
  const { api } = useFinancialBaseModule();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["supplier-planning-summary", supplierId],
    queryFn: () => api.getSupplierPlanningSummary(supplierId),
  });

  if (isLoading) return <section className={`${SURFACE} px-5 py-4 text-sm text-ink-muted`}>A carregar o resumo no planeamento…</section>;
  if (isError || !data) return <section className={`${SURFACE} px-5 py-4 text-sm text-ink-muted`}>Não foi possível carregar o resumo no planeamento.</section>;

  return (
    <div className="space-y-4">
      <SummaryCard s={data} />
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <CategoriesCard s={data} />
        <PriceEvolutionCard s={data} />
      </div>
      <RecentItemsCard s={data} onOpenItems={onOpenItems} />
    </div>
  );
}
