import { formatEUR, formatNumber } from "../../../../lib/format.ts";
import type { ChannelSummary, UnifiedChannel } from "../../domain/entities/sales-summary.ts";
import { useSalesSummaryContext } from "../../sales-summary.module.tsx";

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

const CANONICAL_CHANNELS: UnifiedChannel[] = [
  "salao", "take_away", "eatz", "uber_eats", "glovo", "bolt_food",
];

const ZERO_CHANNEL: Omit<ChannelSummary, "channel"> = {
  grossRevenue: 0,
  transactionCount: 0,
  averageTicket: 0,
  sharePercent: 0,
};

// ─── Row builder ──────────────────────────────────────────────────────────────

function buildRows(byChannel: ChannelSummary[]): ChannelSummary[] {
  const map = new Map(byChannel.map((c) => [c.channel, c]));
  const rows = CANONICAL_CHANNELS.map(
    (ch) => map.get(ch) ?? { channel: ch, ...ZERO_CHANNEL },
  );
  const apps = map.get("apps");
  if (apps) rows.push(apps);
  return rows;
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="mt-6 rounded-xl border border-[#F5C992]/40 bg-white p-5 shadow-sm">
      <div className="mb-4 h-4 w-40 animate-pulse rounded bg-stone-100" />
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-8 animate-pulse rounded bg-stone-100" />
        ))}
      </div>
    </div>
  );
}

// ─── Section ──────────────────────────────────────────────────────────────────

export function ChannelBreakdownSection() {
  const { summary, loading } = useSalesSummaryContext();

  if (loading || !summary) return <Skeleton />;

  const rows = buildRows(summary.byChannel);

  return (
    <div className="mt-6 rounded-xl border border-[#F5C992]/40 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-stone-500">
        Receita por Canal
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-100 text-left text-xs font-medium uppercase tracking-wide text-stone-400">
              <th className="pb-2 pr-4">Canal</th>
              <th className="pb-2 px-4 text-right">Receita Bruta</th>
              <th className="pb-2 px-4 text-right">Transacções</th>
              <th className="pb-2 px-4 text-right">Ticket Médio</th>
              <th className="pb-2 pl-4 text-right">Quota</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-50">
            {rows.map((row) => (
              <tr key={row.channel} className="text-stone-700">
                <td className="py-2 pr-4 font-medium">{CHANNEL_LABELS[row.channel]}</td>
                <td className="py-2 px-4 text-right tabular-nums">
                  {formatEUR(row.grossRevenue / 100)}
                </td>
                <td className="py-2 px-4 text-right tabular-nums">
                  {formatNumber(row.transactionCount)}
                </td>
                <td className="py-2 px-4 text-right tabular-nums">
                  {row.transactionCount > 0 ? formatEUR(row.averageTicket / 100) : "—"}
                </td>
                <td className="py-2 pl-4 text-right tabular-nums">
                  {row.sharePercent.toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
