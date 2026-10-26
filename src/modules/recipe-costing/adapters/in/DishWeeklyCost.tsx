import { useEffect, useState } from "react";
import type { WeeklyDishCostDTO, WeeklyPriceSource } from "../../domain/entities/recipe-costing.ts";
import { useRecipeCostingModule } from "../../recipe-costing.module.tsx";
import { WeeklyLineChart } from "./WeeklyLineChart.tsx";

const SIZE_LABELS: Record<string, string> = { xs: "XS", small: "Pequena", large: "Grande" };
const SOURCE_LABELS: Record<WeeklyPriceSource, string> = {
  purchase: "compra da semana",
  carried: "preço transportado",
  manual: "preço manual",
  none: "sem preço",
};
const eur = (v: number) => v.toLocaleString("pt-PT", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 4 });
const qty = (n: number) => n.toLocaleString("pt-PT", { maximumFractionDigits: 3 });
const pct = (r: number) => `${r > 0 ? "+" : ""}${(r * 100).toLocaleString("pt-PT", { maximumFractionDigits: 1 })}%`;
const dmy = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");

/**
 * Evolução semanal do custo do prato (task V5 §6.3): CMV teórico por prato e por tamanho — versão da
 * ficha técnica em vigor em cada semana × preço de cada ingrediente nessa semana. Assinala preço
 * transportado, preço manual, dados incompletos, versão da receita e semana em curso.
 */
export function DishWeeklyCost({ pizzaId, refreshKey }: { pizzaId: string; refreshKey?: string }) {
  const { api } = useRecipeCostingModule();
  const [data, setData] = useState<WeeklyDishCostDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [size, setSize] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .getDishWeeklyCost(pizzaId, 12)
      .then((d) => !cancelled && setData(d))
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : "Não foi possível calcular o custo semanal."));
    return () => {
      cancelled = true;
    };
  }, [api, pizzaId, refreshKey]);

  if (error) return <p className="mt-3 text-xs text-red-600">{error}</p>;
  if (!data) return <p className="mt-3 text-xs text-ink-muted">A calcular o custo semanal…</p>;
  if (data.sizes.length === 0) {
    return (
      <section aria-label="Evolução semanal do custo" className="mt-4 rounded-lg border border-line p-3">
        <h4 className="text-sm font-semibold text-ink">Evolução semanal do custo</h4>
        <p className="mt-1 text-xs text-ink-muted">Sem versão histórica da ficha técnica — as versões são gravadas a partir da próxima alteração.</p>
      </section>
    );
  }

  const active = data.sizes.find((s) => s.size === size) ?? data.sizes[0]!;
  const current = active.weeks[active.weeks.length - 1]!;
  const listed = [...active.weeks].reverse();

  return (
    <section aria-label="Evolução semanal do custo" className="mt-4 rounded-lg border border-line p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-ink">Evolução semanal do custo</h4>
        {data.sizes.length > 1 && (
          <div role="tablist" aria-label="Tamanho" className="flex gap-1">
            {data.sizes.map((s) => (
              <button
                key={s.size}
                type="button"
                role="tab"
                aria-selected={s.size === active.size}
                onClick={() => setSize(s.size)}
                className={`rounded-md px-2 py-0.5 text-xs font-medium ${s.size === active.size ? "bg-navy-900 text-white" : "text-ink-secondary hover:bg-surface-soft"}`}
              >
                {SIZE_LABELS[s.size] ?? s.size}
              </button>
            ))}
          </div>
        )}
      </div>
      <p className="mt-1 text-xs text-ink-secondary">
        Custo teórico por prato (s/ IVA), da ficha em vigor em cada semana.{" "}
        {current.costWithoutVat !== null && (
          <>
            Atual: <span className="font-semibold text-ink">{eur(current.costWithoutVat)}</span>
            {current.status === "incomplete" && " (incompleto)"}
            {current.changeRatio !== null && ` · ${pct(current.changeRatio)} face à semana anterior`}
          </>
        )}
        {data.firstVersionAt && <span className="text-ink-muted"> · Fichas versionadas desde {dmy(data.firstVersionAt)}</span>}
      </p>

      <div className="mt-2">
        <WeeklyLineChart
          ariaLabel="Custo semanal do prato em euros"
          onSelect={(week) => setOpen(week)}
          points={active.weeks.map((w) => ({
            key: w.week,
            label: w.week.slice(5),
            value: w.costWithoutVat,
            kind: w.status === "ok" ? "solid" : w.status === "incomplete" ? "dashed" : "none",
            tooltip: `${w.week}${w.partial ? " (em curso)" : ""} · ${
              w.status === "no_version" ? "Sem versão histórica da ficha" : `${eur(w.costWithoutVat!)}${w.status === "incomplete" ? " · incompleto" : ""}`
            }`,
          }))}
        />
      </div>

      <table className="mt-2 w-full text-xs">
        <thead>
          <tr className="text-left text-[10px] uppercase tracking-wide text-ink-muted">
            <th className="py-1 font-medium">Semana</th>
            <th className="py-1 text-right font-medium">Custo</th>
            <th className="py-1 text-right font-medium">Variação</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {listed.map((w) => {
            const expanded = open === w.week;
            const flags = [
              w.partial ? "em curso" : null,
              w.status === "incomplete" ? "dados incompletos" : null,
              w.lines.some((l) => l.source === "carried") ? "preço transportado" : null,
              w.lines.some((l) => l.source === "manual") ? "preço manual" : null,
            ].filter(Boolean);
            return [
              <tr
                key={w.week}
                className={w.status === "no_version" ? "" : "cursor-pointer hover:bg-surface-soft"}
                onClick={() => w.status !== "no_version" && setOpen(expanded ? null : w.week)}
                aria-expanded={w.status === "no_version" ? undefined : expanded}
              >
                <td className="py-1 text-ink">
                  {w.week} <span className="text-ink-muted">({dmy(w.weekStart)})</span>
                  {flags.length > 0 && <span className="ml-1 text-[11px] text-ink-muted">· {flags.join(" · ")}</span>}
                </td>
                <td className={`py-1 text-right tabular-nums ${w.status === "incomplete" ? "text-amber-700" : "text-ink"}`}>
                  {w.status === "no_version" ? <span className="text-ink-muted">Sem versão histórica</span> : eur(w.costWithoutVat!)}
                </td>
                <td className="py-1 text-right tabular-nums text-ink-secondary">{w.changeRatio === null ? "—" : pct(w.changeRatio)}</td>
              </tr>,
              expanded && (
                <tr key={`${w.week}-lines`}>
                  <td colSpan={3} className="bg-surface-soft px-2 py-1.5">
                    {w.versionFrom && <p className="mb-1 text-[11px] text-ink-muted">Versão da receita desde {dmy(w.versionFrom)}</p>}
                    <ul className="space-y-0.5">
                      {w.lines.map((l, i) => (
                        <li key={`${l.stockItemId ?? l.preparationId}-${i}`} className="flex flex-wrap justify-between gap-2 text-[11px] text-ink-secondary">
                          <span>
                            {l.name || "—"} · {qty(l.quantity)} {l.baseUnit ?? (l.preparationId ? "(preparo)" : "")}
                          </span>
                          <span className="tabular-nums">
                            <span className={l.complete ? "text-ink-muted" : "text-amber-700"}>{SOURCE_LABELS[l.source]}</span> · {l.complete || l.costWithoutVat > 0 ? eur(l.costWithoutVat) : "—"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </td>
                </tr>
              ),
            ];
          })}
        </tbody>
      </table>
      <p className="mt-1 text-[11px] text-ink-muted">CMV teórico (o que a ficha diz), não consumo real. Não mexe no Stock.</p>
    </section>
  );
}
