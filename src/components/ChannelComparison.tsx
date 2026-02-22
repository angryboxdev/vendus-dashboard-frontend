import { calcDeliveryAppFee, calcDeliveryNetAfterApps } from "../lib/fees";

import { CategoryBreakdown } from "./CategoryBreakdown";
import type { ChannelReport } from "../types/monthlySummary";
import { MiniKpiCard } from "./MiniKpiCard";
import { buildChannelCategoryRowsFromReport } from "./CategoryBreakdown/buildRows";
import { formatEUR } from "../lib/format";

export function ChannelComparison({
  restaurant,
  delivery,
}: {
  restaurant: ChannelReport;
  delivery: ChannelReport;
}) {
  return (
    <div className="mt-6 grid gap-4 lg:grid-cols-2">
      <ChannelColumn title="Restaurant" report={restaurant} />
      <ChannelColumn title="Delivery" report={delivery} />
    </div>
  );
}

function ChannelColumn({
  title,
  report,
}: {
  title: string;
  report: ChannelReport;
}) {
  const t = report.totals;

  const isDelivery = title === "Delivery";
  const appFee = isDelivery ? calcDeliveryAppFee(t.gross) : 0;
  const netAfterApps = isDelivery
    ? calcDeliveryNetAfterApps(t.gross, t.net)
    : t.net;

  const denom = t.documents_count > 0 ? t.documents_count : 1;
  const avgGross = t.documents_count > 0 ? t.gross / denom : 0;
  const avgNet = t.documents_count > 0 ? t.net / denom : 0;

  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <MiniKpiCard title="Bruto (Gross)" value={formatEUR(t.gross)} />
        <MiniKpiCard title="Imposto (IVA)" value={formatEUR(t.tax_amount)} />

        {isDelivery ? (
          <>
            <MiniKpiCard title="Líquido (Antes 30%)" value={formatEUR(t.net)} />
            <MiniKpiCard title="Taxa apps (30%)" value={formatEUR(appFee)} />
            <MiniKpiCard
              title="Líquido (Depois 30%)"
              value={formatEUR(netAfterApps)}
            />
          </>
        ) : (
          <MiniKpiCard title="Líquido (Net)" value={formatEUR(t.net)} />
        )}

        <MiniKpiCard title="Ticket (Bruto)" value={formatEUR(avgGross)} />
        <MiniKpiCard title="Ticket (Líquido)" value={formatEUR(avgNet)} />
        <MiniKpiCard title="Vendas (Docs)" value={t.documents_count} />

        <MiniKpiCard title="Unidades" value={t.units_count} />
      </div>

      {report ? (
        <CategoryBreakdown
          title="Breakdown por categoria"
          rows={buildChannelCategoryRowsFromReport(report)}
        />
      ) : null}
    </div>
  );
}
