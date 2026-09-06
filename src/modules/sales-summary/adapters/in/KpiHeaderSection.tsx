import { formatEUR, formatNumber } from "../../../../lib/format.ts";
import { useSalesSummaryContext } from "../../sales-summary.module.tsx";
import type { SalesSummaryTotals } from "../../domain/entities/sales-summary.ts";

// ─── Delta helper ─────────────────────────────────────────────────────────────

function calcDelta(current: number, comparison: number): number | null {
  if (comparison === 0) return null;
  return ((current - comparison) / Math.abs(comparison)) * 100;
}

function DeltaBadge({
  delta,
  invertColor = false,
}: {
  delta: number | null;
  invertColor?: boolean;
}) {
  if (delta === null) return null;

  const positive = invertColor ? delta < 0 : delta > 0;
  const neutral = delta === 0;

  const colorClass = neutral
    ? "text-stone-400"
    : positive
      ? "text-emerald-600"
      : "text-red-500";

  const arrow = neutral ? "" : delta > 0 ? "↑" : "↓";

  return (
    <span className={`text-xs font-medium ${colorClass}`}>
      {arrow} {Math.abs(delta).toFixed(1)}%
    </span>
  );
}

// ─── Single KPI card ──────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  delta,
  invertColor = false,
  sub,
}: {
  label: string;
  value: string;
  delta: number | null;
  invertColor?: boolean;
  sub?: string;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-[#F5C992]/40 bg-white px-5 py-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-stone-400">
        {label}
      </p>
      <p className="text-xl font-bold text-stone-900">{value}</p>
      {sub && <p className="text-xs text-stone-500">{sub}</p>}
      <DeltaBadge delta={delta} invertColor={invertColor} />
    </div>
  );
}

// ─── Skeleton card ────────────────────────────────────────────────────────────

function KpiCardSkeleton() {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-[#F5C992]/40 bg-white px-5 py-4 shadow-sm">
      <div className="h-3 w-24 animate-pulse rounded bg-stone-100" />
      <div className="h-6 w-32 animate-pulse rounded bg-stone-100" />
    </div>
  );
}

// ─── Section ──────────────────────────────────────────────────────────────────

function buildCards(
  totals: SalesSummaryTotals,
  comparison: SalesSummaryTotals | undefined,
) {
  const d = (key: keyof SalesSummaryTotals) =>
    comparison ? calcDelta(totals[key], comparison[key]) : null;

  return [
    {
      label: "Receita Bruta",
      value: formatEUR(totals.grossRevenue / 100),
      delta: d("grossRevenue"),
    },
    {
      label: "Faturado Total",
      value: formatEUR(totals.faturadoTotal / 100),
      delta: d("faturadoTotal"),
    },
    {
      label: "N.º Cancelamentos",
      value: formatNumber(totals.creditNoteCount),
      delta: d("creditNoteCount"),
      invertColor: true,
    },
    {
      label: "Valor Cancelamentos",
      value: formatEUR(totals.creditNoteValue / 100),
      delta: d("creditNoteValue"),
      invertColor: true,
    },
    {
      label: "IVA Cobrado",
      value: formatEUR(totals.vatCollected / 100),
      delta: d("vatCollected"),
    },
    {
      label: "Receita Líquida",
      value: formatEUR(totals.netRevenue / 100),
      delta: d("netRevenue"),
    },
    {
      label: "N.º Transacções",
      value: formatNumber(totals.transactionCount),
      delta: d("transactionCount"),
    },
    {
      label: "Ticket Médio",
      value: formatEUR(totals.averageTicket / 100),
      delta: d("averageTicket"),
    },
  ] as const;
}

export function KpiHeaderSection() {
  const { summary, comparisonSummary, loading } = useSalesSummaryContext();

  if (loading || !summary) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        {Array.from({ length: 8 }).map((_, i) => (
          <KpiCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  const cards = buildCards(summary.totals, comparisonSummary?.totals);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
      {cards.map((card) => (
        <KpiCard key={card.label} {...card} />
      ))}
    </div>
  );
}
