import { formatEUR, formatNumber } from "../../../../lib/format.ts";
import type { CategorySummary, UnifiedCategory } from "../../domain/entities/sales-summary.ts";
import { useSalesSummaryContext } from "../../sales-summary.module.tsx";

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_ORDER: UnifiedCategory[] = [
  "Pizzas",
  "Bebidas Alcoólicas",
  "Bebidas",
  "Outros",
];

const ZERO_CATEGORY: Omit<CategorySummary, "category"> = {
  itemsSold: 0,
  grossRevenue: 0,
  vatCollected: 0,
  netRevenue: 0,
};

// ─── Row builder ──────────────────────────────────────────────────────────────

function buildRows(byCategory: CategorySummary[]): CategorySummary[] {
  const map = new Map(byCategory.map((c) => [c.category, c]));
  return CATEGORY_ORDER.map((cat) => map.get(cat) ?? { category: cat, ...ZERO_CATEGORY });
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="mt-6 rounded-xl border border-[#F5C992]/40 bg-white p-5 shadow-sm">
      <div className="mb-4 h-4 w-40 animate-pulse rounded bg-stone-100" />
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-8 animate-pulse rounded bg-stone-100" />
        ))}
      </div>
    </div>
  );
}

// ─── Section ──────────────────────────────────────────────────────────────────

export function CategoryBreakdownSection() {
  const { summary, loading } = useSalesSummaryContext();

  if (loading || !summary) return <Skeleton />;

  const rows = buildRows(summary.byCategory);

  return (
    <div className="mt-6 rounded-xl border border-[#F5C992]/40 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-stone-500">
        Receita por Categoria
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-100 text-left text-xs font-medium uppercase tracking-wide text-stone-400">
              <th className="pb-2 pr-4">Categoria</th>
              <th className="pb-2 px-4 text-right">Qtd. Vendida</th>
              <th className="pb-2 px-4 text-right">Receita Bruta</th>
              <th className="pb-2 px-4 text-right">IVA</th>
              <th className="pb-2 pl-4 text-right">Receita Líquida</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-50">
            {rows.map((row) => (
              <tr key={row.category} className="text-stone-700">
                <td className="py-2 pr-4 font-medium">{row.category}</td>
                <td className="py-2 px-4 text-right tabular-nums">
                  {formatNumber(row.itemsSold)}
                </td>
                <td className="py-2 px-4 text-right tabular-nums">
                  {formatEUR(row.grossRevenue / 100)}
                </td>
                <td className="py-2 px-4 text-right tabular-nums">
                  {formatEUR(row.vatCollected / 100)}
                </td>
                <td className="py-2 pl-4 text-right tabular-nums">
                  {formatEUR(row.netRevenue / 100)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
