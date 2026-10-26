import { useEffect, useMemo, useState } from "react";
import type { DishesImpactDTO, RecipeCostingReportDTO, WeeklyPriceSource } from "../../domain/entities/recipe-costing.ts";
import { DISH_CATEGORY_LABELS, VARIANT_LABELS } from "../../domain/entities/technical-sheets.ts";
import { useRecipeCostingModule } from "../../recipe-costing.module.tsx";
import { DishWeeklyCost } from "./DishWeeklyCost.tsx";
import { Pill } from "./sheet-ui.tsx";
import { eur, eurCost, inputCls, pct, qty } from "./sheet-format.ts";

const PERIODS = [4, 8, 12] as const;
const SOURCE: Record<WeeklyPriceSource, string> = { purchase: "compra", carried: "transportado", manual: "manual", none: "sem preço" };
const signed = (v: number) => `${v > 0 ? "+" : ""}${eurCost(v)}`;
const tone = (v: number | null) => (v === null || Math.abs(v) < 0.0005 ? "text-ink-muted" : v > 0 ? "text-red-700" : "text-emerald-700");

type Row = DishesImpactDTO["dishes"][number] & { size: DishesImpactDTO["dishes"][number]["sizes"][number] };

/**
 * Análise de custos (V7): custo atual de cada prato × variante face a há 4/8/12 semanas (receita
 * atual aplicada aos preços de cada semana — reconstrução), com o detalhe por componente, a margem
 * atual e o histórico real (versões da ficha) do prato selecionado.
 */
export function CostAnalysis({ report, refreshKey }: { report: RecipeCostingReportDTO | null; refreshKey: number }) {
  const { api } = useRecipeCostingModule();
  const [weeks, setWeeks] = useState<number>(4);
  const [data, setData] = useState<DishesImpactDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState("");
  const [onlyActive, setOnlyActive] = useState(true);
  const [sel, setSel] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .getDishesImpact(weeks)
      .then((d) => {
        if (!cancelled) {
          setData(d);
          setError(null);
        }
      })
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : "Não foi possível calcular a análise."));
    return () => {
      cancelled = true;
    };
  }, [api, weeks, refreshKey]);

  const rows = useMemo<Row[]>(() => {
    if (!data) return [];
    return data.dishes
      .filter((d) => (!onlyActive || d.isActive) && (!category || d.category === category))
      .flatMap((d) => d.sizes.map((size) => ({ ...d, size })))
      .sort((a, b) => (b.size.change ?? -Infinity) - (a.size.change ?? -Infinity) || a.name.localeCompare(b.name, "pt"));
  }, [data, onlyActive, category]);
  const selected = rows.find((r) => `${r.pizzaId}:${r.size.size}` === sel) ?? rows.find((r) => r.size.comparable) ?? rows[0] ?? null;
  const current = selected ? report?.dishes.find((d) => d.pizzaId === selected.pizzaId)?.sizes.find((s) => s.size === selected.size.size) : undefined;

  return (
    <div className="mt-4 space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col text-[11px] text-ink-muted">
          Comparar com
          <div role="group" aria-label="Comparar com" className="mt-0.5 inline-flex overflow-hidden rounded-md border border-line bg-surface-card">
            {PERIODS.map((p) => (
              <button key={p} type="button" aria-pressed={weeks === p} onClick={() => setWeeks(p)} className={`px-3 py-1.5 text-xs ${weeks === p ? "bg-navy-900 text-white" : "text-ink-secondary hover:bg-surface-soft"}`}>
                {p} semanas
              </button>
            ))}
          </div>
        </div>
        <label className="flex flex-col text-[11px] text-ink-muted">
          Categoria
          <select value={category} onChange={(e) => setCategory(e.target.value)} className={`${inputCls} mt-0.5`}>
            <option value="">Todas</option>
            {Object.entries(DISH_CATEGORY_LABELS).map(([k, l]) => (
              <option key={k} value={k}>{l}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1.5 pb-1.5 text-xs text-ink">
          <input type="checkbox" checked={onlyActive} onChange={(e) => setOnlyActive(e.target.checked)} />
          Só ativos
        </label>
      </div>
      {data && (
        <p className="rounded-md bg-surface-soft px-3 py-2 text-[11px] text-ink-secondary">
          Reconstrução com a receita atual: a composição de hoje aplicada aos preços de compra de cada semana ({data.now.week} face a {data.then.week}). Não é o custo efetivamente praticado nessas semanas.
        </p>
      )}
      {error && <p className="text-xs text-red-700">{error}</p>}
      {!data && !error && <p className="text-xs text-ink-muted">A calcular…</p>}

      {data && (
        <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
          <div className="overflow-x-auto rounded-xl border border-line bg-surface-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-ink-muted">
                  <th className="px-3 py-2 font-medium">Prato · variante</th>
                  <th className="px-3 py-2 text-right font-medium">Atual</th>
                  <th className="px-3 py-2 text-right font-medium">Há {weeks} sem.</th>
                  <th className="px-3 py-2 text-right font-medium">Variação</th>
                  <th className="px-3 py-2 font-medium">Principal componente</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((r) => {
                  const key = `${r.pizzaId}:${r.size.size}`;
                  const s = r.size;
                  const on = selected && key === `${selected.pizzaId}:${selected.size.size}`;
                  return (
                    <tr
                      key={key}
                      tabIndex={0}
                      aria-selected={!!on}
                      onClick={() => setSel(key)}
                      onKeyDown={(e) => e.key === "Enter" && setSel(key)}
                      className={`cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500 ${on ? "bg-brand-50" : "hover:bg-surface-soft"}`}
                    >
                      <td className="px-3 py-2">
                        <p className="font-medium text-ink">{r.name}</p>
                        <p className="text-[11px] text-ink-muted">{VARIANT_LABELS[s.size] ?? s.size}{!r.isActive ? " · inativo" : ""}</p>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{eurCost(s.now.costWithoutVat)}{!s.now.complete && <p className="text-[11px] text-amber-800">parcial</p>}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-ink-secondary">{eurCost(s.then.costWithoutVat)}{!s.then.complete && <p className="text-[11px] text-amber-800">parcial</p>}</td>
                      <td className={`px-3 py-2 text-right tabular-nums ${tone(s.change)}`}>
                        {s.comparable && s.change !== null ? (
                          <>
                            {signed(s.change)}
                            {s.changeRatio !== null && <p className="text-[11px]">{s.changeRatio > 0 ? "+" : ""}{pct(s.changeRatio)}</p>}
                          </>
                        ) : (
                          <Pill tone="neutral">Não comparável</Pill>
                        )}
                      </td>
                      <td className="px-3 py-2 text-ink-secondary">{s.comparable && s.mainFactor && Math.abs(s.mainFactor.diff) >= 0.0005 ? <>{s.mainFactor.name}<p className="text-[11px]">{signed(s.mainFactor.diff)}</p></> : "—"}</td>
                    </tr>
                  );
                })}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-sm text-ink-muted">Sem pratos com ficha nestes filtros.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {selected && (
            <aside aria-label="Detalhe da variação" className="space-y-4 rounded-xl border border-line bg-surface-card p-4">
              <div>
                <h3 className="text-sm font-semibold text-ink">{selected.name} · {VARIANT_LABELS[selected.size.size] ?? selected.size.size}</h3>
                <p className="text-[11px] text-ink-muted">{DISH_CATEGORY_LABELS[selected.category] ?? selected.category} · custo teórico s/ IVA</p>
              </div>
              {selected.size.comparable && selected.size.change !== null ? (
                <dl className="grid grid-cols-3 gap-2">
                  <div><dt className="text-[11px] text-ink-muted">Atual</dt><dd className="font-semibold tabular-nums">{eurCost(selected.size.now.costWithoutVat)}</dd></div>
                  <div><dt className="text-[11px] text-ink-muted">Há {weeks} semanas</dt><dd className="font-semibold tabular-nums">{eurCost(selected.size.then.costWithoutVat)}</dd></div>
                  <div><dt className="text-[11px] text-ink-muted">Variação</dt><dd className={`font-semibold tabular-nums ${tone(selected.size.change)}`}>{signed(selected.size.change)}</dd></div>
                </dl>
              ) : (
                <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Não comparável: {!selected.size.now.complete ? "há componentes sem custo conhecido" : `faltam preços em ${data.then.week}`}. Resolva o custo em Artigos e ingredientes e a comparação aparece.
                </p>
              )}
              <div className="rounded-md bg-surface-soft px-3 py-2 text-xs">
                {current?.margin ? (
                  <span>Margem atual s/ IVA <b className="tabular-nums">{eur(current.margin.marginWithoutVat)}</b> ({pct(current.margin.marginRatio)}) · CMV {pct(current.margin.foodCostRatio)} · PVP {eur(current.salePrice ?? 0)}</span>
                ) : (
                  <span className="text-ink-muted">Margem: {current?.salePrice == null ? "sem PVP nesta variante" : "custo parcial — não calculada"}.</span>
                )}
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-ink-muted">
                    <th className="py-1 font-medium">Componente</th>
                    <th className="py-1 text-right font-medium">Agora</th>
                    <th className="py-1 text-right font-medium">Antes</th>
                    <th className="py-1 text-right font-medium">Diferença</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {[...selected.size.lines].sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff)).map((l, i) => (
                    <tr key={`${l.stockItemId ?? l.preparationId ?? l.name}-${i}`}>
                      <td className="py-1.5 text-ink">
                        {l.name} <span className="text-ink-muted">{qty(l.quantity)} {l.baseUnit ?? ""}</span>
                        {!l.complete && <span className="ml-1 text-red-700">sem preço</span>}
                      </td>
                      <td className="py-1.5 text-right tabular-nums">{eurCost(l.nowCost)} <span className="text-ink-muted">({SOURCE[l.nowSource]})</span></td>
                      <td className="py-1.5 text-right tabular-nums text-ink-secondary">{eurCost(l.thenCost)}</td>
                      <td className={`py-1.5 text-right tabular-nums ${tone(l.diff)}`}>{signed(l.diff)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-[11px] text-ink-muted">A soma das diferenças por componente dá a variação total.</p>
              <DishWeeklyCost pizzaId={selected.pizzaId} refreshKey={String(refreshKey)} />
            </aside>
          )}
        </div>
      )}
    </div>
  );
}
