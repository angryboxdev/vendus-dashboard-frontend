import { AlertBanner, FIELD, SECTION_TITLE, SURFACE, Skeleton, StatusBadge, TABLE, TD, TH, THEAD, TR } from "../../../../components/ui/index.ts";
import { formatEUR } from "../../../../lib/format.ts";
import type { FoodCost } from "../../domain/entities/food-cost.ts";
import { changeFor, dishOptions, packagingChange, targetValue } from "../../domain/services/food-cost-view.ts";
import { useFoodCost } from "./use-food-cost.ts";

const euros = (cents: number | null) => (cents === null ? "—" : formatEUR(cents / 100));
const SELECT = `${FIELD} py-1 text-xs`;

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <p className="text-xs text-ink-secondary">{label}</p>
      <p className="text-lg font-semibold tabular-nums text-navy-900">{value}</p>
      {hint && <p className="text-xs text-ink-secondary">{hint}</p>}
    </div>
  );
}

/** Opções de «Corresponde a»: sugestão, pratos por tamanho, upgrade, artigos de stock, ignorar. */
function TargetOptions({ f, suggestion }: { f: FoodCost; suggestion: string | null }) {
  return (
    <>
      <option value="auto">{suggestion ? `Sugestão: ${suggestion}` : "— Sem correspondência —"}</option>
      <optgroup label="Fichas técnicas">
        {dishOptions(f.targets.dishes).map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </optgroup>
      <option value="upgrade">Upgrade para Grande</option>
      <optgroup label="Artigos de stock">
        {f.targets.items.map((i) => (
          <option key={i.stockItemId} value={`item:${i.stockItemId}`}>
            {i.name}
          </option>
        ))}
      </optgroup>
      <option value="ignore">Ignorar (não é comida nem bebida)</option>
    </>
  );
}

/**
 * Custo real da comida e da embalagem do delivery no mês: produtos do SAF-T do AirMenu ligados às fichas
 * técnicas e aos artigos de stock (sugestão pelo nome, corrigível), mais a embalagem por pizza e pedido.
 */
export function FoodCostCard({ year, month }: { year: number; month: number }) {
  const v = useFoodCost(year, month);
  const f = v.foodCost;
  if (v.error) {
    return (
      <AlertBanner tone="danger" title="Não foi possível calcular o custo da comida">
        {v.error}
      </AlertBanner>
    );
  }
  if (v.loading || !f) return <Skeleton className="h-64" />;
  if (!f.hasProducts) {
    return (
      <section className={`${SURFACE} p-6`} aria-labelledby="dp-food">
        <h2 id="dp-food" className={SECTION_TITLE}>
          Custo da comida e embalagem
        </h2>
        <p className="mt-2 text-sm text-ink-secondary">Importe o SAF-T do AirMenu do mês para calcular o custo real pelas fichas técnicas (até lá, a margem usa 30%).</p>
      </section>
    );
  }

  return (
    <section className={`${SURFACE} p-6`} aria-labelledby="dp-food">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="dp-food" className={SECTION_TITLE}>
          Custo da comida e embalagem <span className="font-normal text-ink-secondary">· SAF-T × fichas técnicas e artigos, sem IVA</span>
        </h2>
        <StatusBadge tone={f.complete ? "success" : "warning"}>{f.complete ? "Completo — usado na margem" : "Incompleto — a margem usa 30%"}</StatusBadge>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-4">
        <Kpi label="Custo ÷ vendas" value={f.foodCostPct === null ? "—" : `${f.foodCostPct.toLocaleString("pt-PT")}%`} hint={f.complete ? "Real" : "Com os dados atuais"} />
        <Kpi label="Comida e bebidas" value={euros(f.productsCostCents + f.extrapolatedCostCents)} hint={f.extrapolatedCostCents ? `${euros(f.extrapolatedCostCents)} estimados` : undefined} />
        <Kpi label="Embalagem" value={euros(f.packagingCostCents)} hint={`${f.ordersCount} pedidos`} />
        <Kpi label="Vendas sem IVA" value={euros(f.revenueNetCents)} hint={`${euros(f.costedRevenueNetCents)} com custo conhecido`} />
      </div>
      {v.saveError && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {v.saveError}
        </p>
      )}

      <div className="mt-4 overflow-x-auto">
        <table className={TABLE}>
          <thead className={THEAD}>
            <tr>
              <th className={TH}>Produto (AirMenu)</th>
              <th className={`${TH} text-right`}>Qtd.</th>
              <th className={`${TH} text-right`}>Vendas</th>
              <th className={TH}>Corresponde a</th>
              <th className={`${TH} text-right`}>Custo un.</th>
              <th className={`${TH} text-right`}>Custo</th>
            </tr>
          </thead>
          <tbody>
            {f.lines.map((l) => (
              <tr key={l.productKey} className={TR}>
                <td className={TD}>{l.description}</td>
                <td className={`${TD} text-right tabular-nums`}>{l.quantity}</td>
                <td className={`${TD} text-right tabular-nums`}>{euros(l.netCents)}</td>
                <td className={TD}>
                  <select
                    aria-label={`Corresponde a — ${l.description}`}
                    className={SELECT}
                    value={targetValue(l.target)}
                    disabled={v.saving}
                    onChange={(e) => v.saveChange(changeFor(l, e.target.value))}
                  >
                    <TargetOptions f={f} suggestion={l.target?.source === "auto" ? l.target.label : null} />
                  </select>
                </td>
                <td className={`${TD} text-right tabular-nums`}>{euros(l.unitCostCents)}</td>
                <td className={`${TD} text-right tabular-nums ${l.complete ? "" : "text-amber-700"}`}>{euros(l.costCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 className="mt-6 text-xs font-semibold uppercase tracking-wide text-ink-secondary">Embalagem</h3>
      <div className="mt-2 overflow-x-auto">
        <table className={TABLE}>
          <tbody>
            {f.packaging.map((p) => (
              <tr key={p.key} className={TR}>
                <td className={TD}>{p.label}</td>
                <td className={TD}>
                  <select
                    aria-label={`Artigo — ${p.label}`}
                    className={SELECT}
                    value={p.item?.source === "manual" ? p.item.stockItemId : "auto"}
                    disabled={v.saving}
                    onChange={(e) => v.saveChange(packagingChange(p, e.target.value))}
                  >
                    <option value="auto">{p.item?.source === "auto" ? `Pelo nome: ${p.item.name}` : "— Sem artigo —"}</option>
                    {f.targets.items.map((i) => (
                      <option key={i.stockItemId} value={i.stockItemId}>
                        {i.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className={`${TD} text-right tabular-nums`}>{p.quantity}</td>
                <td className={`${TD} text-right tabular-nums`}>{euros(p.unitCostCents)}</td>
                <td className={`${TD} text-right tabular-nums ${p.costCents === null && p.quantity > 0 ? "text-amber-700" : ""}`}>{euros(p.costCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {f.warnings.length > 0 && (
        <ul className="mt-3 list-disc space-y-0.5 pl-5 text-xs text-ink-secondary">
          {f.warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-xs text-ink-secondary">
        Pizza = Pequena; cada «Upgrade para L» soma a diferença Grande − Pequena. Os custos vêm das fichas técnicas e dos artigos de stock (Stock → Fichas
        técnicas / Artigos).
      </p>
    </section>
  );
}
