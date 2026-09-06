import { formatEUR, formatNumber } from "../../../../lib/format.ts";
import type { UnifiedChannel } from "../../domain/entities/sales-summary.ts";
import { useSalesSummaryContext, type TopProductsLimit } from "../../sales-summary.module.tsx";

// ─── Constants ────────────────────────────────────────────────────────────────

const CHANNEL_LABELS: Record<UnifiedChannel, string> = {
  salao: "Salão",
  take_away: "Take Away",
  eatz: "Eatz",
  uber_eats: "Uber Eats",
  glovo: "Glovo",
  bolt_food: "Bolt Food",
  apps: "Plataformas (legado)",
};

const LIMIT_OPTIONS: TopProductsLimit[] = [10, 20, 50];

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="mt-6 rounded-xl border border-[#F5C992]/40 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div className="h-4 w-40 animate-pulse rounded bg-stone-100" />
        <div className="h-7 w-24 animate-pulse rounded bg-stone-100" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="h-8 animate-pulse rounded bg-stone-100" />
        ))}
      </div>
    </div>
  );
}

// ─── Section ──────────────────────────────────────────────────────────────────

export function TopProductsSection() {
  const { summary, loading, topProductsLimit, setTopProductsLimit } = useSalesSummaryContext();

  if (loading || !summary) return <Skeleton />;

  const products = summary.topProducts.slice(0, topProductsLimit);

  return (
    <div className="mt-6 rounded-xl border border-[#F5C992]/40 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
          Top Produtos
        </h2>
        <select
          value={topProductsLimit}
          onChange={(e) => setTopProductsLimit(Number(e.target.value) as TopProductsLimit)}
          className="rounded-md border border-stone-200 bg-white px-2 py-1 text-xs font-medium text-stone-600 shadow-sm focus:outline-none"
        >
          {LIMIT_OPTIONS.map((n) => (
            <option key={n} value={n}>
              Top {n}
            </option>
          ))}
        </select>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-100 text-left text-xs font-medium uppercase tracking-wide text-stone-400">
              <th className="pb-2 pr-3 text-right">#</th>
              <th className="pb-2 px-4">Produto</th>
              <th className="pb-2 px-4 text-right">Qtd.</th>
              <th className="pb-2 px-4 text-right">Receita Bruta</th>
              <th className="pb-2 pl-4">Canais</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-50">
            {products.map((product, i) => (
              <tr key={product.normalizedTitle} className="text-stone-700">
                <td className="py-2 pr-3 text-right text-xs text-stone-400 tabular-nums">
                  {i + 1}
                </td>
                <td className="py-2 px-4 font-medium">{product.normalizedTitle}</td>
                <td className="py-2 px-4 text-right tabular-nums">
                  {formatNumber(product.quantitySold)}
                </td>
                <td className="py-2 px-4 text-right tabular-nums">
                  {formatEUR(product.grossRevenue / 100)}
                </td>
                <td className="py-2 pl-4 text-xs text-stone-500">
                  {product.channels.map((ch) => CHANNEL_LABELS[ch]).join(", ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
