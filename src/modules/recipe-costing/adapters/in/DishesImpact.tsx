import { Fragment, useEffect, useMemo, useState } from "react";
import type { DishesImpactDTO, WeeklyPriceSource } from "../../domain/entities/recipe-costing.ts";
import { useRecipeCostingModule } from "../../recipe-costing.module.tsx";

const SIZE_LABELS: Record<string, string> = { small: "Pequena", large: "Grande" };
const SOURCE_LABELS: Record<WeeklyPriceSource, string> = {
  purchase: "compra",
  carried: "transportado",
  manual: "manual",
  none: "sem preço",
};
const PERIODS = [4, 8, 12] as const;
const eur = (v: number) => v.toLocaleString("pt-PT", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 4 });
const signedEur = (v: number) => `${v > 0 ? "+" : ""}${eur(v)}`;
const pct = (r: number) => `${r > 0 ? "+" : ""}${(r * 100).toLocaleString("pt-PT", { maximumFractionDigits: 1 })}%`;
const qty = (n: number) => n.toLocaleString("pt-PT", { maximumFractionDigits: 3 });
const dmy = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");
const changeTone = (v: number | null) => (v === null || Math.abs(v) < 0.005 ? "text-ink-muted" : v > 0 ? "text-red-700" : "text-emerald-700");

type Row = DishesImpactDTO["dishes"][number] & { size: DishesImpactDTO["dishes"][number]["sizes"][number] };

/**
 * «Impacto nas pizzas» (task V6 §8): custo teórico atual de cada pizza (s/ IVA) face a há N semanas,
 * com a variação e o ingrediente que mais pesou; a linha expande a diferença por ingrediente. É uma
 * reconstrução (ficha técnica atual × preços de cada semana) e não mostra margem (sem regra de IVA
 * das vendas).
 */
export function DishesImpact({ categoryLabels = {}, refreshKey }: { categoryLabels?: Record<string, string>; refreshKey?: string | number }) {
  const { api } = useRecipeCostingModule();
  const [weeks, setWeeks] = useState<number>(4);
  const [data, setData] = useState<DishesImpactDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [onlyActive, setOnlyActive] = useState(true);

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
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : "Não foi possível calcular o impacto."));
    return () => {
      cancelled = true;
    };
  }, [api, weeks, refreshKey]);

  // Uma linha por pizza × tamanho; as maiores subidas primeiro, as não comparáveis no fim.
  const rows = useMemo<Row[]>(() => {
    if (!data) return [];
    return data.dishes
      .filter((d) => !onlyActive || d.isActive)
      .flatMap((d) => d.sizes.map((size) => ({ ...d, size })))
      .sort((a, b) => (b.size.change ?? -Infinity) - (a.size.change ?? -Infinity) || a.name.localeCompare(b.name, "pt"));
  }, [data, onlyActive]);

  return (
    <section aria-label="Impacto nas pizzas" className="rounded-lg border border-line bg-surface-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-ink">Impacto nas pizzas</h3>
          <p className="text-xs text-ink-muted">Custo teórico s/ IVA por pizza: semana atual face a há {weeks} semanas.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <label className="flex items-center gap-1.5 text-ink-muted">
            <input type="checkbox" checked={onlyActive} onChange={(e) => setOnlyActive(e.target.checked)} />
            Só ativas
          </label>
          <div role="group" aria-label="Comparar com" className="inline-flex overflow-hidden rounded-md border border-line">
            {PERIODS.map((p) => (
              <button
                key={p}
                type="button"
                aria-pressed={weeks === p}
                onClick={() => setWeeks(p)}
                className={`px-2.5 py-1 text-xs ${weeks === p ? "bg-brand-600 text-white" : "text-ink hover:bg-surface-soft"}`}
              >
                {p} sem.
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
      {!error && !data && <p className="mt-3 text-xs text-ink-muted">A calcular o impacto…</p>}
      {data && (
        <>
          <p className="mt-2 text-[11px] text-ink-muted">
            {data.method}. Semana atual {data.now.week} vs {data.then.week} (início {dmy(data.then.weekStart)}). Margem não apresentada: falta a regra de IVA das vendas.
          </p>
          {rows.length === 0 ? (
            <p className="mt-3 text-sm text-ink-muted">Sem fichas técnicas com versão gravada.</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs text-ink-muted">
                    <th className="py-2 pr-3 font-medium">Pizza</th>
                    <th className="py-2 pr-3 font-medium">Categoria</th>
                    <th className="py-2 pr-3 text-right font-medium">Custo atual</th>
                    <th className="py-2 pr-3 text-right font-medium">Há {weeks} semanas</th>
                    <th className="py-2 pr-3 text-right font-medium">Variação</th>
                    <th className="py-2 font-medium">Fator principal</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const key = `${r.pizzaId}:${r.size.size}`;
                    const expanded = open === key;
                    const s = r.size;
                    return (
                      <Fragment key={key}>
                        <tr className="cursor-pointer border-b border-line/60 hover:bg-surface-soft" onClick={() => setOpen(expanded ? null : key)}>
                          <td className="py-2 pr-3">
                            <button type="button" aria-expanded={expanded} className="text-left font-medium text-ink">
                              {r.name}
                              {r.sizes.length > 1 && <span className="ml-1 text-xs font-normal text-ink-muted">({SIZE_LABELS[s.size] ?? s.size})</span>}
                              {!r.isActive && <span className="ml-1 text-xs font-normal text-ink-muted">· inativa</span>}
                            </button>
                          </td>
                          <td className="py-2 pr-3 text-ink-muted">{categoryLabels[r.category] ?? r.category}</td>
                          <td className="py-2 pr-3 text-right tabular-nums">
                            {eur(s.now.costWithoutVat)}
                            {!s.now.complete && <span className="ml-1 text-xs text-amber-700" title="Há ingredientes sem preço nesta semana">incompleto</span>}
                          </td>
                          <td className="py-2 pr-3 text-right tabular-nums text-ink-muted">
                            {eur(s.then.costWithoutVat)}
                            {!s.then.complete && <span className="ml-1 text-xs text-amber-700" title="Há ingredientes sem preço nessa semana">incompleto</span>}
                          </td>
                          <td className={`py-2 pr-3 text-right tabular-nums ${changeTone(s.change)}`}>
                            {s.comparable && s.change !== null ? (
                              <>
                                {signedEur(s.change)}
                                {s.changeRatio !== null && <span className="ml-1 text-xs">({pct(s.changeRatio)})</span>}
                              </>
                            ) : (
                              <span className="text-xs text-ink-muted" title="Uma das semanas tem ingredientes sem preço">Não comparável</span>
                            )}
                          </td>
                          <td className="py-2 text-ink-muted">
                            {s.comparable && s.mainFactor && Math.abs(s.mainFactor.diff) >= 0.005 ? `${s.mainFactor.name} (${signedEur(s.mainFactor.diff)})` : "—"}
                          </td>
                        </tr>
                        {expanded && (
                          <tr className="border-b border-line/60 bg-surface-soft/60">
                            <td colSpan={6} className="px-3 py-2">
                              <table className="min-w-full text-xs">
                                <thead>
                                  <tr className="text-left text-ink-muted">
                                    <th className="py-1 pr-3 font-medium">Ingrediente / preparo</th>
                                    <th className="py-1 pr-3 text-right font-medium">Quantidade</th>
                                    <th className="py-1 pr-3 text-right font-medium">Agora</th>
                                    <th className="py-1 pr-3 text-right font-medium">Há {weeks} sem.</th>
                                    <th className="py-1 text-right font-medium">Diferença</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {[...s.lines]
                                    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
                                    .map((l, i) => (
                                      <tr key={`${l.stockItemId ?? l.preparationId ?? l.name}-${i}`}>
                                        <td className="py-1 pr-3 text-ink">
                                          {l.name}
                                          {!l.complete && <span className="ml-1 text-amber-700">sem preço</span>}
                                        </td>
                                        <td className="py-1 pr-3 text-right tabular-nums">
                                          {qty(l.quantity)} {l.baseUnit ?? ""}
                                        </td>
                                        <td className="py-1 pr-3 text-right tabular-nums">
                                          {eur(l.nowCost)} <span className="text-ink-muted">({SOURCE_LABELS[l.nowSource]})</span>
                                        </td>
                                        <td className="py-1 pr-3 text-right tabular-nums">
                                          {eur(l.thenCost)} <span className="text-ink-muted">({SOURCE_LABELS[l.thenSource]})</span>
                                        </td>
                                        <td className={`py-1 text-right tabular-nums ${changeTone(l.diff)}`}>{signedEur(l.diff)}</td>
                                      </tr>
                                    ))}
                                </tbody>
                              </table>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}
