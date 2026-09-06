import { useState } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { formatEUR } from "../../../../lib/format.ts";
import type { MonthlyGrowthPoint } from "../../domain/entities/sales-summary.ts";
import { useSalesSummaryContext } from "../../sales-summary.module.tsx";

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTH_SHORT = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

type ChartMode = "bar" | "line";

// ─── Data ─────────────────────────────────────────────────────────────────────

interface ChartPoint {
  label: string;
  year: number;
  month: number;
  vendus: number;
  airMenu: number;
  noData: boolean;
}

function buildChartData(points: MonthlyGrowthPoint[]): ChartPoint[] {
  return points.map((p) => ({
    label: MONTH_SHORT[p.month - 1],
    year: p.year,
    month: p.month,
    vendus: p.cachedAt === null ? 0 : p.vendusRevenue / 100,
    airMenu: p.cachedAt === null ? 0 : p.airMenuRevenue / 100,
    noData: p.cachedAt === null,
  }));
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ color: string; name: string; value: number }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const noData = (payload[0] as any)?.payload?.noData as boolean;

  return (
    <div className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-semibold text-stone-700">{label}</p>
      {noData ? (
        <p className="italic text-stone-400">sem dados</p>
      ) : (
        payload.map((entry) => (
          <p key={entry.name} style={{ color: entry.color }}>
            {entry.name}: {formatEUR(entry.value)}
          </p>
        ))
      )}
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="mt-6 rounded-xl border border-[#F5C992]/40 bg-white p-5 shadow-sm">
      <div className="mb-4 h-4 w-48 animate-pulse rounded bg-stone-100" />
      <div className="h-56 animate-pulse rounded bg-stone-100" />
    </div>
  );
}

// ─── Section ──────────────────────────────────────────────────────────────────

export function GrowthChartSection() {
  const { growthChart, growthLoading, selectedPeriod, setPeriod } =
    useSalesSummaryContext();
  const [mode, setMode] = useState<ChartMode>("bar");

  if (growthLoading || !growthChart) return <Skeleton />;

  const data = buildChartData(growthChart);

  const handleClick = (chartData: { activePayload?: Array<{ payload: ChartPoint }> }) => {
    const point = chartData?.activePayload?.[0]?.payload;
    if (!point || point.noData) return;
    setPeriod({ year: point.year, month: point.month });
  };

  const commonAxisProps = {
    axisLine: false as const,
    tickLine: false as const,
  };

  const yAxisProps = {
    ...commonAxisProps,
    tickFormatter: (v: number) => formatEUR(v),
    tick: { fontSize: 10, fill: "#78716c" },
    width: 85,
  };

  return (
    <div className="mt-6 rounded-xl border border-[#F5C992]/40 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
          Evolução Anual — {selectedPeriod.year}
        </h2>
        <div className="flex gap-1">
          {(["bar", "line"] as ChartMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                mode === m
                  ? "bg-[#ED5C32] text-white"
                  : "bg-stone-100 text-stone-600 hover:bg-stone-200"
              }`}
            >
              {m === "bar" ? "Barras" : "Linha"}
            </button>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={220}>
        {mode === "bar" ? (
          <BarChart
            data={data}
            onClick={handleClick}
            style={{ cursor: "pointer" }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f4" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: "#78716c" }}
              {...commonAxisProps}
            />
            <YAxis {...yAxisProps} />
            <Tooltip content={<ChartTooltip />} />
            <Legend
              formatter={(value) => (
                <span style={{ fontSize: 12, color: "#57534e" }}>{value}</span>
              )}
            />
            <Bar
              dataKey="vendus"
              name="Vendus"
              stackId="a"
              fill="#ED5C32"
              radius={[0, 0, 2, 2]}
            />
            <Bar
              dataKey="airMenu"
              name="AirMenu"
              stackId="a"
              fill="#EF8935"
              radius={[2, 2, 0, 0]}
            />
          </BarChart>
        ) : (
          <LineChart
            data={data}
            onClick={handleClick}
            style={{ cursor: "pointer" }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f4" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: "#78716c" }}
              {...commonAxisProps}
            />
            <YAxis {...yAxisProps} />
            <Tooltip content={<ChartTooltip />} />
            <Legend
              formatter={(value) => (
                <span style={{ fontSize: 12, color: "#57534e" }}>{value}</span>
              )}
            />
            <Line
              dataKey="vendus"
              name="Vendus"
              stroke="#ED5C32"
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
            <Line
              dataKey="airMenu"
              name="AirMenu"
              stroke="#EF8935"
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
