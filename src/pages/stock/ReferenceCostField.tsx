import { NumericInput } from "../../components/NumericInput.tsx";
import { formatEUR } from "../../lib/format";
import {
  fromPricingUnitCost,
  pricingUnit,
  toPricingUnitCost,
} from "../../modules/recipe-costing/domain/services/pricing-unit.ts";

const round6 = (n: number) => Math.round(n * 1_000_000) / 1_000_000;

/**
 * Custo de referência introduzido como as pessoas pensam o preço (€/kg, €/l); o catálogo
 * continua a guardar por unidade base (g, ml, cl). Evita «7,79 € por grama» ao escrever o preço ao kg.
 */
export function ReferenceCostField({
  label,
  baseUnit,
  value,
  onChange,
}: {
  label: string;
  baseUnit: string;
  /** Custo por unidade base (o que o catálogo guarda). */
  value: number | null;
  onChange: (perBaseUnit: number | null) => void;
}) {
  const unit = pricingUnit(baseUnit);
  return (
    <div>
      <label className="mb-1 block text-xs text-slate-500">
        {label} por {unit.label} (€)
      </label>
      <NumericInput
        decimals={unit.factor > 1 ? 2 : 4}
        value={value == null || value === 0 ? "" : round6(toPricingUnitCost(value, baseUnit))}
        onChange={(e) => {
          const n = e.target.value !== "" ? Number(e.target.value) : NaN;
          onChange(Number.isFinite(n) && n > 0 ? fromPricingUnitCost(n, baseUnit) : null);
        }}
        className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
        placeholder="Opcional"
      />
    </div>
  );
}

/** «5,58 €/kg» a partir do custo por unidade base. */
// eslint-disable-next-line react-refresh/only-export-components
export function formatPerPricingUnit(perBaseUnit: number, baseUnit: string): string {
  return `${formatEUR(round6(toPricingUnitCost(perBaseUnit, baseUnit)))}/${pricingUnit(baseUnit).label}`;
}
