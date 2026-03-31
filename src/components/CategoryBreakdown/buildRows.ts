import { CATEGORY_LABELS } from "../../lib/categoryLabels";
import type { CategoryRow } from "../../types/CategoryBreakdown.types";
import type { ChannelReport } from "../../types/monthlySummary";
import type { MonthlySummary } from "../../types/monthlySummary";

export function buildOverallCategoryRows(data: MonthlySummary): CategoryRow[] {
  return CATEGORY_LABELS.map(({ key, label }) => {
    const categoryData = data.by_category_overall[key];
    const totals = categoryData.totals;
    const products = data.products_overall
      .filter((p) => p.category === key)
      .sort((a, b) => b.amounts.gross_total - a.amounts.gross_total);

    return { key, label, totals, products };
  });
}

export function buildChannelCategoryRowsFromReport(
  report: ChannelReport
): CategoryRow[] {
  const byCat = report.byCategory;

  return CATEGORY_LABELS.map(({ key, label }) => {
    const entry = byCat[key];
    const totals = entry?.totals ?? {
      gross: 0,
      net: 0,
      tax_amount: 0,
      units_count: 0,
      documents_count: 0,
      items_count: 0,
    };
    const products = (entry?.products ?? [])
      .slice()
      .sort((a, b) => b.amounts.gross_total - a.amounts.gross_total);

    return { key, label, totals, products };
  });
}
