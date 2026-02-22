import { useEffect, useMemo, useState } from "react";

import { CategoryBreakdown } from "./components/CategoryBreakdown/index";
import { ChannelComparison } from "./components/ChannelComparison";
import { DebugPanel } from "./components/DebugPanel";
import { HeaderFilters } from "./components/HeaderFilters";
import { KpiCard } from "./components/KpiCard";
import type { MonthlySummary } from "./types/monthlySummary";
import { ProductsTable } from "./components/ProductsTable";
import { apiGet } from "./lib/api";
import { buildOverallCategoryRows } from "./components/CategoryBreakdown/buildRows";
import { formatEUR } from "./lib/format";

export default function App() {
  const [since, setSince] = useState("2026-01-12");
  const [until, setUntil] = useState("2026-01-12");
  const [type, setType] = useState("FS");

  const [data, setData] = useState<MonthlySummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const url = useMemo(() => {
    const qs = new URLSearchParams({ since, until });
    return `/api/reports/monthly-summary?${qs.toString()}`;
  }, [since, until]);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const json = await apiGet<MonthlySummary>(url);
      setData(json);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao carregar");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totals = data?.totals;
  const docsCount = totals?.documents_count ?? 0;
  const ticketBruto = docsCount > 0 && totals ? totals.gross / docsCount : null;
  const ticketLiquido = docsCount > 0 && totals ? totals.net / docsCount : null;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl p-6">
        <HeaderFilters
          since={since}
          until={until}
          type={type}
          loading={loading}
          onChange={(next) => {
            if (next.since) setSince(next.since);
            if (next.until) setUntil(next.until);
            if (next.type) setType(next.type);
          }}
          onRefresh={load}
        />

        {error ? (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <div className="mt-6 grid gap-4 grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 auto-rows-fr">
          <KpiCard
            title="Bruto (Gross)"
            value={totals ? formatEUR(totals.gross) : "—"}
          />
          <KpiCard
            title="Líquido (Net)"
            value={totals ? formatEUR(totals.net) : "—"}
          />
          <KpiCard
            title="Imposto (IVA)"
            value={totals ? formatEUR(totals.tax_amount) : "—"}
          />
          <KpiCard title="Unidades" value={totals ? totals.units_count : "—"} />
          <KpiCard
            title="Vendas (Docs)"
            value={totals?.documents_count ?? "—"}
          />
          <KpiCard
            title="Ticket (Bruto)"
            value={ticketBruto != null ? formatEUR(ticketBruto) : "—"}
          />
          <KpiCard
            title="Ticket (Líquido)"
            value={ticketLiquido != null ? formatEUR(ticketLiquido) : "—"}
          />
        </div>

        {data ? (
          <CategoryBreakdown
            title="Breakdown por categoria (geral)"
            rows={buildOverallCategoryRows(data)}
          />
        ) : null}

        {data ? (
          <ChannelComparison
            restaurant={data.by_channel.restaurant}
            delivery={data.by_channel.delivery}
          />
        ) : null}

        {data ? (
          <ProductsTable
            products={data.products_overall}
            totalsGross={data.totals.gross}
          />
        ) : null}

        {data ? <DebugPanel url={url} debug={data.debug} /> : null}
      </div>
    </div>
  );
}
