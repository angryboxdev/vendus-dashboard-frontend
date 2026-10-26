import { useEffect, useMemo, useState } from "react";
import type { IngredientPriceHistoryDTO } from "../../domain/entities/recipe-costing.ts";
import { observationPrice, priceChartPoints } from "../../domain/services/price-history-view.ts";
import { pricingUnit } from "../../domain/services/pricing-unit.ts";
import { useRecipeCostingModule } from "../../recipe-costing.module.tsx";
import { WeeklyLineChart } from "./WeeklyLineChart.tsx";

const eur = (v: number) => v.toLocaleString("pt-PT", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 4 });
const cents = (c: number) => (c / 100).toLocaleString("pt-PT", { style: "currency", currency: "EUR" });
const qty = (n: number) => n.toLocaleString("pt-PT", { maximumFractionDigits: 3 });
const pct = (r: number) => `${r > 0 ? "+" : ""}${(r * 100).toLocaleString("pt-PT", { maximumFractionDigits: 1 })}%`;
const dmy = (s: string) => s.split("-").reverse().join("/");
const shortWeek = (w: string) => w.slice(5); // «W41»

/**
 * Evolução do preço de compra (task V5 §5.3): preço médio ponderado por semana, depois do desconto
 * de cada linha, s/ IVA, em €/kg (ou €/l, €/un). Semanas sem compra mostram o último preço só como
 * referência (linha tracejada, marcador vazio). Ao escolher uma semana vê as faturas que a compõem.
 */
export function IngredientPriceHistory({ stockItemId }: { stockItemId: string }) {
  const { api } = useRecipeCostingModule();
  const [history, setHistory] = useState<IngredientPriceHistoryDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .getPriceHistory(stockItemId, 26)
      .then((h) => !cancelled && setHistory(h))
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : "Não foi possível ler o histórico de preços."));
    return () => {
      cancelled = true;
    };
  }, [api, stockItemId]);

  const chart = useMemo(() => (history ? priceChartPoints(history) : null), [history]);

  if (error) return <p className="text-xs text-red-600">{error}</p>;
  if (!history || !chart) return <p className="text-xs text-ink-muted">A carregar o histórico de preços…</p>;

  const toPrice = (centsPerUnit: number) => (centsPerUnit * pricingUnit(history.baseUnit).factor) / 100;
  const values = chart.points.map((p) => p.value).filter((v): v is number => v !== null);
  const purchaseWeeks = history.weeks.filter((w) => w.avgCentsPerUnit !== null).reverse();
  const current = history.weeks[history.weeks.length - 1];
  if (values.length === 0) {
    return (
      <section aria-label="Evolução do preço de compra" className="rounded-lg border border-line p-3">
        <h3 className="text-sm font-semibold text-ink">Evolução do preço de compra</h3>
        <p className="mt-1 text-xs text-ink-muted">Custo indisponível — ainda sem compras confirmadas para o Stock (Compras por rever).</p>
      </section>
    );
  }

  return (
    <section aria-label="Evolução do preço de compra" className="rounded-lg border border-line p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-ink">Evolução do preço de compra</h3>
        <span className="text-[11px] text-ink-muted">€/{chart.unit} s/ IVA, depois do desconto · média ponderada por semana</span>
      </div>
      <p className="mt-1 text-xs text-ink-secondary">
        {history.lastPurchase
          ? `Última compra: ${eur(toPrice(history.lastPurchase.centsPerUnit))}/${chart.unit} · ${dmy(history.lastPurchase.invoiceDate)} · ${history.lastPurchase.supplierName}`
          : "Sem compras."}
        {current && current.avgCentsPerUnit === null && current.carriedFromWeek && ` · Esta semana: sem nova compra (referência de ${current.carriedFromWeek})`}
      </p>

      <div className="mt-2">
        <WeeklyLineChart
          ariaLabel={`Preço semanal em euros por ${chart.unit}`}
          onSelect={(week) => chart.points.find((p) => p.week === week)?.kind === "purchase" && setSelected(week)}
          points={chart.points.map((p, i) => {
            const w = history.weeks[i]!;
            const head = `${p.week}${p.partial ? " (em curso)" : ""} · `;
            return {
              key: p.week,
              label: shortWeek(p.week),
              value: p.value,
              kind: p.kind === "purchase" ? "solid" : p.kind === "carried" ? "dashed" : "none",
              tooltip:
                head +
                (p.kind === "purchase"
                  ? `${eur(p.value!)}/${chart.unit} · ${qty(w.quantity)} ${history.baseUnit}`
                  : p.kind === "carried"
                    ? `Sem nova compra · referência ${eur(p.value!)}/${chart.unit} de ${w.carriedFromWeek}`
                    : "Sem preço"),
            };
          })}
        />
      </div>

      <table className="mt-2 w-full text-xs">
        <thead>
          <tr className="text-left text-[10px] uppercase tracking-wide text-ink-muted">
            <th className="py-1 font-medium">Semana</th>
            <th className="py-1 text-right font-medium">Quantidade</th>
            <th className="py-1 text-right font-medium">Preço médio</th>
            <th className="py-1 text-right font-medium">Variação</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {purchaseWeeks.map((w) => {
            const price = toPrice(w.avgCentsPerUnit!);
            const open = selected === w.week;
            return [
              <tr key={w.week} className="cursor-pointer hover:bg-surface-soft" onClick={() => setSelected(open ? null : w.week)} aria-expanded={open}>
                <td className="py-1 text-ink">
                  {w.week} <span className="text-ink-muted">({dmy(w.weekStart)})</span>
                  {w.partial && <span className="ml-1 text-ink-muted">· em curso</span>}
                </td>
                <td className="py-1 text-right tabular-nums text-ink-secondary">{qty(w.quantity)} {history.baseUnit}</td>
                <td className="py-1 text-right font-medium tabular-nums text-ink">{eur(price)}/{chart.unit}</td>
                <td className="py-1 text-right tabular-nums text-ink-secondary">{w.changeRatio === null ? "—" : pct(w.changeRatio)}</td>
              </tr>,
              open && (
                <tr key={`${w.week}-lines`}>
                  <td colSpan={4} className="bg-surface-soft px-2 py-1.5">
                    <ul className="space-y-0.5">
                      {w.observations.map((o) => {
                        const p = observationPrice(o.netCents, o.quantity, history.baseUnit);
                        return (
                          <li key={o.lineId} className="flex flex-wrap justify-between gap-2 text-[11px] text-ink-secondary">
                            <span>
                              {o.invoiceNumber} · {dmy(o.invoiceDate)} · {o.supplierName}
                            </span>
                            <span className="tabular-nums">
                              {qty(o.quantity)} {history.baseUnit}
                              {o.discountCents ? ` · desconto ${cents(o.discountCents)}` : ""} · líquido {cents(o.netCents)}
                              {p !== null && ` · ${eur(p)}/${chart.unit}`}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </td>
                </tr>
              ),
            ];
          })}
        </tbody>
      </table>
      <p className="mt-1 text-[11px] text-ink-muted">
        Últimas {history.weeks.length} semanas · {history.weeks.length - purchaseWeeks.length} sem nova compra. Só compras confirmadas nas Compras por rever.
      </p>
    </section>
  );
}
