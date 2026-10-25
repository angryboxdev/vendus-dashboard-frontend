import { useCallback, useEffect, useMemo, useState } from "react";
import { NumericInput } from "../../../../components/NumericInput.tsx";
import { formatEUR } from "../../../../lib/format.ts";
import type {
  CostSource,
  MissingPriceIngredientDTO,
  RecipeCostingReportDTO,
} from "../../domain/entities/recipe-costing.ts";
import { fromPricingUnitCost, pricingUnit, toPricingUnitCost } from "../../domain/services/pricing-unit.ts";
import { useRecipeCostingModule } from "../../recipe-costing.module.tsx";

const SIZE_LABELS: Record<string, string> = { small: "Pequena", large: "Grande" };
const SOURCE_LABELS: Record<CostSource, string> = { invoice: "Fatura", manual: "Manual" };

function formatUnitCost(value: number): string {
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR", maximumFractionDigits: 4 }).format(value);
}

/**
 * Custo das fichas técnicas (s/ IVA), recalculado a cada leitura a partir do
 * último preço de compra de cada ingrediente. `refreshKey` muda quando a
 * página altera receitas, para voltar a ler.
 */
export function RecipeCostingSection({ refreshKey = 0 }: { refreshKey?: number }) {
  const { api } = useRecipeCostingModule();
  const [report, setReport] = useState<RecipeCostingReportDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setReport(await api.getReport());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao calcular o custo das fichas técnicas");
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const dishes = useMemo(
    () => (report?.dishes ?? []).filter((d) => d.isActive).sort((a, b) => a.name.localeCompare(b.name, "pt")),
    [report],
  );
  const sizes = useMemo(() => {
    const all = new Set(dishes.flatMap((d) => d.sizes.map((s) => s.size)));
    return ["small", "large", ...[...all].filter((s) => s !== "small" && s !== "large")].filter((s) => all.has(s));
  }, [dishes]);
  const missingNames = useMemo(
    () => new Map((report?.missingPrices ?? []).map((m) => [m.stockItemId, m.name])),
    [report],
  );

  return (
    <section>
      <div>
        <h2 className="text-lg font-semibold text-slate-800">Custo das fichas técnicas</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Custo s/ IVA com o último preço de compra de cada ingrediente — atualiza-se sozinho a cada fatura importada.
          Sem compra, usa o preço manual.
        </p>
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {report && report.missingPrices.length > 0 && (
        <MissingPricesAlert missing={report.missingPrices} onSaved={load} />
      )}

      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        {loading && !report ? (
          <div className="p-8 text-center text-sm text-slate-500">A carregar…</div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-600">
                <th className="px-4 py-3 font-medium">Pizza</th>
                {sizes.map((size) => (
                  <th key={size} className="px-4 py-3 text-right font-medium">
                    {SIZE_LABELS[size] ?? size}
                    <span className="block text-xs font-normal text-slate-400">custo s/ IVA · PVP</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dishes.map((dish) => (
                <tr key={dish.pizzaId} className="border-t border-slate-100">
                  <td className="px-4 py-2 font-medium text-slate-800">{dish.name}</td>
                  {sizes.map((size) => {
                    const cost = dish.sizes.find((s) => s.size === size);
                    if (!dish.hasActiveRecipe) {
                      return (
                        <td key={size} className="px-4 py-2 text-right text-xs text-slate-400">
                          Sem ficha técnica
                        </td>
                      );
                    }
                    if (!cost) return <td key={size} className="px-4 py-2 text-right text-slate-400">—</td>;
                    const missing = cost.missingStockItemIds.map((id) => missingNames.get(id) ?? id);
                    return (
                      <td key={size} className="px-4 py-2 text-right tabular-nums">
                        <span className={cost.complete ? "text-slate-800" : "text-amber-700"}>
                          {formatEUR(cost.costWithoutVat)}
                        </span>
                        <span className="text-slate-400"> · {cost.salePrice != null ? formatEUR(cost.salePrice) : "—"}</span>
                        {!cost.complete && (
                          <span
                            className="ml-2 inline-flex rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800"
                            title={`Sem preço: ${missing.join(", ")}`}
                          >
                            incompleto
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {dishes.length === 0 && (
                <tr>
                  <td colSpan={sizes.length + 1} className="px-4 py-8 text-center text-slate-500">
                    Nenhuma pizza ativa
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {report && report.ingredients.length > 0 && (
        <details className="mt-3 rounded-xl border border-slate-200 bg-white shadow-sm">
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-slate-700">
            Preço dos ingredientes ({report.ingredients.length})
          </summary>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-t border-slate-200 text-slate-600">
                <th className="px-4 py-2 font-medium">Ingrediente</th>
                <th className="px-4 py-2 text-right font-medium">Preço s/ IVA</th>
                <th className="px-4 py-2 font-medium">Origem</th>
              </tr>
            </thead>
            <tbody>
              {report.ingredients.map((ing) => {
                const unit = pricingUnit(ing.baseUnit);
                const priced = ing.unitCostWithoutVat != null && ing.unitCostWithoutVat > 0;
                return (
                  <tr key={ing.stockItemId} className="border-t border-slate-100">
                    <td className="px-4 py-2 text-slate-800">{ing.name}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-slate-700">
                      {priced ? `${formatUnitCost(toPricingUnitCost(ing.unitCostWithoutVat!, ing.baseUnit))} / ${unit.label}` : "—"}
                    </td>
                    <td className="px-4 py-2">
                      {priced && ing.source ? (
                        <span
                          className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${
                            ing.source === "invoice" ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {SOURCE_LABELS[ing.source]}
                        </span>
                      ) : (
                        <span className="inline-flex rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                          Sem preço
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </details>
      )}
    </section>
  );
}

function MissingPricesAlert({
  missing,
  onSaved,
}: {
  missing: MissingPriceIngredientDTO[];
  onSaved: () => void;
}) {
  return (
    <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
      <p className="text-sm font-medium text-amber-900">
        {missing.length === 1 ? "1 ingrediente sem preço" : `${missing.length} ingredientes sem preço`} — o custo das
        pizzas que os usam está incompleto.
      </p>
      <p className="mt-0.5 text-xs text-amber-800">
        Preencha à mão ou importe uma fatura com o artigo. O preço da fatura importada passa sempre à frente do manual.
      </p>
      <ul className="mt-3 space-y-2">
        {missing.map((m) => (
          <MissingPriceRow key={m.stockItemId} ingredient={m} onSaved={onSaved} />
        ))}
      </ul>
    </div>
  );
}

function MissingPriceRow({ ingredient, onSaved }: { ingredient: MissingPriceIngredientDTO; onSaved: () => void }) {
  const { api } = useRecipeCostingModule();
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const unit = pricingUnit(ingredient.baseUnit);

  const save = async () => {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) {
      setError("Indique um preço maior que zero");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.setManualUnitCost(ingredient.stockItemId, fromPricingUnitCost(n, ingredient.baseUnit));
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao guardar o preço");
    } finally {
      setSaving(false);
    }
  };

  return (
    <li className="flex flex-wrap items-center gap-3 rounded border border-amber-100 bg-white px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-800">{ingredient.name}</p>
        <p className="truncate text-xs text-slate-500">Usado em: {ingredient.usedIn.map((d) => d.name).join(", ")}</p>
      </div>
      <div className="flex items-center gap-2">
        <NumericInput
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-28 rounded border border-slate-200 px-2 py-1 text-right text-sm"
          placeholder="0,00"
          aria-label={`Preço s/ IVA de ${ingredient.name} por ${unit.label}`}
        />
        <span className="text-xs text-slate-500">€ / {unit.label} s/ IVA</span>
        <button
          type="button"
          onClick={save}
          disabled={saving || value === ""}
          className="rounded bg-slate-700 px-3 py-1 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {saving ? "A guardar…" : "Guardar"}
        </button>
      </div>
      {error && <p className="w-full text-xs text-red-700">{error}</p>}
    </li>
  );
}
