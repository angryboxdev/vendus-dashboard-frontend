import { useSalesSummaryContext } from "../../sales-summary.module.tsx";
import { CacheStatusBar } from "./CacheStatusBar.tsx";
import { CategoryBreakdownSection } from "./CategoryBreakdownSection.tsx";
import { ChannelBreakdownSection } from "./ChannelBreakdownSection.tsx";
import { GrowthChartSection } from "./GrowthChartSection.tsx";
import { KpiHeaderSection } from "./KpiHeaderSection.tsx";
import { PeriodSelector } from "./PeriodSelector.tsx";
import { TemporalDistributionSection } from "./TemporalDistributionSection.tsx";
import { TopProductsSection } from "./TopProductsSection.tsx";

const MONTH_LABELS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export function SalesSummaryView() {
  const { selectedPeriod, error } = useSalesSummaryContext();

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4 border-b border-[#F5C992]/40 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Resultados</h1>
          <p className="mt-0.5 text-sm text-stone-500">
            {MONTH_LABELS[(selectedPeriod.month - 1)]} {selectedPeriod.year}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <PeriodSelector />
          <CacheStatusBar />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* KPI cards */}
      <KpiHeaderSection />

      {/* Growth chart */}
      <GrowthChartSection />

      {/* Channel + Category + Top Products */}
      <ChannelBreakdownSection />
      <CategoryBreakdownSection />
      <TopProductsSection />

      {/* Temporal distribution */}
      <TemporalDistributionSection />
    </div>
  );
}
