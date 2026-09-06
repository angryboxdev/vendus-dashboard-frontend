import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ResponsiveContainer,
} from "recharts";
import { formatEUR, formatNumber } from "../../../../lib/format.ts";
import type { TimeBucket } from "../../domain/entities/sales-summary.ts";
import { useSalesSummaryContext } from "../../sales-summary.module.tsx";

// ─── Tooltip ──────────────────────────────────────────────────────────────────

function BucketTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: TimeBucket }>;
}) {
  if (!active || !payload?.length) return null;
  const bucket = payload[0].payload;

  return (
    <div className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-semibold text-stone-700">
        {String(bucket.hour).padStart(2, "0")}h
      </p>
      <p className="text-stone-600">
        Receita: <span className="tabular-nums">{formatEUR(bucket.grossRevenue / 100)}</span>
      </p>
      <p className="text-stone-600">
        Facturas: <span className="tabular-nums">{formatNumber(bucket.invoiceCount)}</span>
      </p>
      {bucket.creditNoteCount > 0 && (
        <p className="text-red-500">
          Notas crédito: <span className="tabular-nums">{formatNumber(bucket.creditNoteCount)}</span>
        </p>
      )}
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="mt-6 rounded-xl border border-[#F5C992]/40 bg-white p-5 shadow-sm">
      <div className="mb-4 h-4 w-56 animate-pulse rounded bg-stone-100" />
      <div className="h-48 animate-pulse rounded bg-stone-100" />
    </div>
  );
}

// ─── Section ──────────────────────────────────────────────────────────────────

export function TemporalDistributionSection() {
  const { summary, loading } = useSalesSummaryContext();

  if (loading || !summary) return <Skeleton />;

  const buckets = summary.temporalDistribution;

  // Fill any missing hours so the X axis is always 0–23
  const data: TimeBucket[] = Array.from({ length: 24 }, (_, h) => {
    return (
      buckets.find((b) => b.hour === h) ?? {
        hour: h,
        invoiceCount: 0,
        creditNoteCount: 0,
        grossRevenue: 0,
      }
    );
  });

  return (
    <div className="mt-6 rounded-xl border border-[#F5C992]/40 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-stone-500">
        Distribuição Horária
      </h2>

      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} barCategoryGap="20%">
          <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f4" />
          <XAxis
            dataKey="hour"
            tickFormatter={(h: number) => `${String(h).padStart(2, "0")}h`}
            tick={{ fontSize: 10, fill: "#78716c" }}
            axisLine={false}
            tickLine={false}
            interval={1}
          />
          <YAxis
            tickFormatter={(v: number) => formatEUR(v / 100)}
            tick={{ fontSize: 10, fill: "#78716c" }}
            axisLine={false}
            tickLine={false}
            width={85}
          />
          <Tooltip content={<BucketTooltip />} />
          <Bar dataKey="grossRevenue" radius={[2, 2, 0, 0]}>
            {data.map((bucket) => (
              <Cell
                key={bucket.hour}
                fill={bucket.grossRevenue < 0 ? "#e11d48" : "#ED5C32"}
                fillOpacity={bucket.grossRevenue === 0 ? 0.25 : 1}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {data.some((b) => b.grossRevenue < 0) && (
        <p className="mt-2 text-xs text-red-500">
          Barras vermelhas indicam horas com mais cancelamentos do que facturas.
        </p>
      )}
    </div>
  );
}
