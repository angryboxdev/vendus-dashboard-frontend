import type { CategoryBreakdownProps } from "../../types/CategoryBreakdown.types";
import { formatEUR } from "../../lib/format";

export function CategoryBreakdown({
  title,
  rows,
  emptyText = "Sem itens nessa categoria.",
  defaultOpenKeys = [],
}: CategoryBreakdownProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white mt-6">
      <div className="px-5 py-4">
        <h3 className="text-sm font-medium text-slate-700">{title}</h3>
      </div>

      <div className="border-t border-slate-100">
        {rows.map((row) => (
          <details
            key={row.key}
            className="group border-t border-slate-100 first:border-t-0"
            open={defaultOpenKeys.includes(row.key)}
          >
            <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 hover:bg-slate-50">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div className="text-sm font-semibold text-slate-900">
                    {row.label}
                  </div>

                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                    {row.totals.items_count} itens
                  </span>
                </div>

                <div className="mt-1 text-xs text-slate-500">
                  Líquido {formatEUR(row.totals.net)} • IVA{" "}
                  {formatEUR(row.totals.tax_amount)}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-base font-semibold text-slate-900">
                  {formatEUR(row.totals.gross)}
                </div>
                <Chevron />
              </div>
            </summary>

            <div className="bg-white px-4 pb-4">
              {row.paymentMethods?.length > 0 && (
                <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  {row.paymentMethods.map((pm) => (
                    <span key={pm.method}>
                      <strong className="text-slate-700">{pm.method}:</strong>{" "}
                      {formatEUR(pm.amount)}
                    </span>
                  ))}
                </div>
              )}
              {row.products.length === 0 ? (
                <div className="pt-2 text-sm text-slate-500">{emptyText}</div>
              ) : (
                <div className="mt-2 overflow-hidden rounded-xl border border-slate-100">
                  {row.products.map((p) => (
                    <div
                      key={p.reference}
                      className="flex items-center justify-between border-t border-slate-100 px-3 py-2 first:border-t-0"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-slate-900">
                          {p.title}
                        </div>
                        <div className="text-xs text-slate-500">
                          {p.reference} • {p.qty} un • IVA {p.tax_rate}%
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-sm font-semibold text-slate-900">
                          {formatEUR(p.amounts.gross_total)}
                        </div>
                        <div className="text-xs text-slate-500">
                          {formatEUR(p.amounts.avg_gross_unit)} / un
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}

function Chevron() {
  return (
    <svg
      className="h-5 w-5 text-slate-400 transition-transform group-open:rotate-180"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
        clipRule="evenodd"
      />
    </svg>
  );
}
