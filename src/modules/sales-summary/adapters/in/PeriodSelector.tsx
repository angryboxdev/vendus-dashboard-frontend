import { useSalesSummaryContext } from "../../sales-summary.module.tsx";

const MONTH_LABELS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: CURRENT_YEAR - 2022 }, (_, i) => 2023 + i);

export function PeriodSelector() {
  const { selectedPeriod, setPeriod, loading, refreshing } = useSalesSummaryContext();
  const disabled = loading || refreshing;

  return (
    <div className="flex items-center gap-2">
      <select
        value={selectedPeriod.month}
        disabled={disabled}
        onChange={(e) =>
          setPeriod({ ...selectedPeriod, month: Number(e.target.value) })
        }
        className="rounded-lg border border-[#F5C992]/60 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 shadow-sm focus:outline-none disabled:opacity-50"
      >
        {MONTH_LABELS.map((label, i) => (
          <option key={i + 1} value={i + 1}>
            {label}
          </option>
        ))}
      </select>

      <select
        value={selectedPeriod.year}
        disabled={disabled}
        onChange={(e) =>
          setPeriod({ ...selectedPeriod, year: Number(e.target.value) })
        }
        className="rounded-lg border border-[#F5C992]/60 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 shadow-sm focus:outline-none disabled:opacity-50"
      >
        {YEARS.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
    </div>
  );
}
