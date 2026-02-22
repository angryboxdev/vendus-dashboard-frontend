export type Channel = "restaurant" | "delivery" | "unknown";

export type Category =
  | "pizza"
  | "bebida_alcoolica"
  | "bebida_nao_alcoolica"
  | "sacos"
  | "outros";

export type AggTotals = {
  gross: number;
  net: number;
  tax_amount: number;
  units_count: number;
  documents_count: number;
};

export type TaxBreakdownItem = {
  rate: number;
  base: number;
  amount: number;
  total: number;
};

export type ProductChannelAgg = {
  qty: number;
  gross_total: number;
  net_total: number;
};

export type ProductAgg = {
  reference: string;
  title: string;
  category: Category;
  tax_rate: number;
  qty: number;
  amounts: {
    gross_total: number;
    net_total: number;
    tax_total: number;
    avg_gross_unit: number;
    avg_net_unit: number;
  };
  channels: {
    restaurant: { qty: number; gross_total: number; net_total: number };
    delivery: { qty: number; gross_total: number; net_total: number };
    unknown: { qty: number; gross_total: number; net_total: number };
  };
  payment_methods: PaymentMethodEntry[];
};

export type PaymentMethodEntry = {
  method: "Multibanco" | "Dinheiro" | "Transferência Bancária";
  amount: number;
};

export type PaymentMethodSummaryEntry = PaymentMethodEntry & {
  documents_count: number;
};

export type CategoryBucket = {
  totals: AggTotals;
  products: ProductAgg[];
  payment_methods: PaymentMethodEntry[];
};

export type ChannelReport = {
  totals: AggTotals;
  byCategory: Record<Category, CategoryBucket>;
  payment_methods: PaymentMethodEntry[];
};

export type UnknownChannelReport = {
  totals: AggTotals;
  notes: string;
  by_category: Record<Category, CategoryBucket>;
  payment_methods: PaymentMethodEntry[];
};

export type Totals = AggTotals & {
  tax_breakdown: TaxBreakdownItem[];
};

export type Debug = {
  took_ms: number;
  pages_fetched: number;
  documents_fetched: number;
  documents_detailed_fetched: number;
  rate_limit_notes: string;
  unknown_items_count: number;
  unknown_items_sample: Array<{
    doc_id: number | string;
    doc_number: string;
    title: string;
    reference: string;
    qty: number;
    gross_unit: number;
    gross_total: number;
  }>;
  price_map: {
    version: number;
    tolerance: number;
    mapped_products_count: number;
  };
};

export type MonthlySummary = {
  period: { since: string; until: string; timezone: string };
  source: {
    store_id: number | null;
    documents_count: number;
    documents_types: string[];
  };
  totals: Totals;
  by_channel: {
    restaurant: ChannelReport;
    delivery: ChannelReport;
    unknown: UnknownChannelReport;
  };
  by_category_overall: Record<
    Category,
    { totals: AggTotals; payment_methods: PaymentMethodEntry[] }
  >;
  products_overall: ProductAgg[];
  payment_methods: PaymentMethodSummaryEntry[];
  debug: Debug;
};
