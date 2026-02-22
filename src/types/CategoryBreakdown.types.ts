import type {
  AggTotals,
  Category,
  PaymentMethodEntry,
  ProductAgg,
} from "./monthlySummary";

export type CategoryRow = {
  key: Category;
  label: string;
  totals: AggTotals;
  products: ProductAgg[];
  paymentMethods: PaymentMethodEntry[];
};

export type CategoryBreakdownProps = {
  title: string;
  rows: CategoryRow[];
  emptyText?: string;
  defaultOpenKeys?: Category[];
};
