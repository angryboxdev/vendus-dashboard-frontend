import type { VendusSelfConsumptionSummary } from "../types/monthlySummary";
import { formatEUR } from "../lib/format";

export function SelfConsumptionSection({
  data,
}: {
  data: VendusSelfConsumptionSummary | null | undefined;
}) {
  if (!data) return null;
  if (data.error) {
    return (
      <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50/50 p-4">
        <h3 className="text-base font-semibold text-amber-800">
          Autoconsumo Vendus
        </h3>
        <p className="mt-2 text-sm text-amber-700">{data.error}</p>
      </div>
    );
  }
  const records = data.records ?? [];
  if (records.length === 0 && data.total_spending == null) {
    return (
      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="text-base font-semibold text-slate-800">
          Autoconsumo Vendus
        </h3>
        <p className="mt-2 text-sm text-slate-500">
          Nenhum registo de autoconsumo no período.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-slate-800">
            Autoconsumo Vendus
          </h3>
          <div className="flex items-center gap-4 text-sm text-slate-600">
            {data.total_spending != null && (
              <span>
                Total: <strong>{formatEUR(data.total_spending)}</strong>
              </span>
            )}
            <span>{data.records_count ?? records.length} registos</span>
            {data.details_fetch_truncated && (
              <span className="text-amber-600">
                (detalhes truncados por limite)
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="max-h-80 overflow-y-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-white text-slate-600">
              <th className="px-4 py-2 font-medium">Data/Hora</th>
              <th className="px-4 py-2 font-medium">Funcionário</th>
              <th className="px-4 py-2 font-medium text-right">Total</th>
              <th className="px-4 py-2 font-medium">Produtos</th>
            </tr>
          </thead>
          <tbody>
            {records.map((r, i) => (
              <tr
                key={r.id ?? i}
                className="border-t border-slate-100 hover:bg-slate-50/50"
              >
                <td className="px-4 py-2 text-slate-700">
                  {r.consumption_datetime ?? "—"}
                </td>
                <td className="px-4 py-2 text-slate-700">
                  {r.employee_name ?? "—"}
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-slate-700">
                  {r.total != null ? formatEUR(r.total) : "—"}
                </td>
                <td className="px-4 py-2">
                  {r.products && r.products.length > 0 ? (
                    <ul className="space-y-0.5 text-xs text-slate-600">
                      {r.products.map((p, j) => (
                        <li key={j}>
                          {p.reference}: {p.title} × {p.qty}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
