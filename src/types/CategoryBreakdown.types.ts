import type { AggTotals, Category, ProductAgg } from "./monthlySummary";

export type CategoryRow = {
  key: Category;
  label: string;
  totals: AggTotals;
  products: ProductAgg[];
};

export type CategoryBreakdownProps = {
  title: string;
  rows: CategoryRow[];
  emptyText?: string;
  defaultOpenKeys?: Category[];
};
