import { useDrePeriod } from "./DrePeriodContext";
import { useDreStore } from "./DreStoreContext";

const MONTH_NAMES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const YEARS = [
  2025, 2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033, 2034, 2035,
];

export function DrePeriodSelector() {
  const { period, setYear, setMonth } = useDrePeriod();
  const {
    refresh,
    loadingReceitaBruta,
    loadingCustosFixos,
    loadingCustosVariaveis,
    loadingKpis,
  } = useDreStore();
  const loading =
    loadingReceitaBruta ||
    loadingCustosFixos ||
    loadingCustosVariaveis ||
    loadingKpis;

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-6 py-4">
      <span className="text-sm font-medium text-slate-600">Período</span>
      <div className="flex items-center gap-2">
        <select
          value={period.month}
          onChange={(e) => setMonth(Number(e.target.value))}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-300"
          aria-label="Mês"
        >
          {MONTH_NAMES.map((name, i) => (
            <option key={i} value={i + 1}>
              {name}
            </option>
          ))}
        </select>
        <select
          value={period.year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-300"
          aria-label="Ano"
        >
          {YEARS.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>
      <button
        type="button"
        onClick={refresh}
        disabled={loading}
        className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
      >
        {loading ? "A carregar…" : "Atualizar"}
      </button>
    </div>
  );
}
