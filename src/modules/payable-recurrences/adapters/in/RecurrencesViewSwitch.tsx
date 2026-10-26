import { useNavigate } from "react-router-dom";

export type RecurrencesViewMode = "month" | "history";

const OPTIONS: { mode: RecurrencesViewMode; label: string; path: string }[] = [
  { mode: "month", label: "Do mês", path: "/financial/recurrences" },
  { mode: "history", label: "Histórico", path: "/financial/recurrences/history" },
];

/** Troca entre as recorrências do mês (predefinida) e o histórico (início, pausa, fim). */
export function RecurrencesViewSwitch({ active }: { active: RecurrencesViewMode }) {
  const navigate = useNavigate();
  return (
    <div className="inline-flex rounded-lg border border-stone-300 bg-white p-0.5" role="tablist">
      {OPTIONS.map((o) => (
        <button
          key={o.mode}
          role="tab"
          aria-selected={active === o.mode}
          onClick={() => { if (active !== o.mode) navigate(o.path); }}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            active === o.mode
              ? "bg-gradient-to-r from-[#ED5C32] to-[#EF8935] text-white"
              : "text-stone-600 hover:bg-stone-50"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
