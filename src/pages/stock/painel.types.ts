export type IngredientConsumptionEntry = {
  stock_item_id: string;
  name: string;
  base_unit: string;
  quantity_consumed: number;
  type?: "ingredient" | "other";
  category_id?: string;
  category_name?: string;
};

export type StockAdditionEntry = {
  stock_item_id: string;
  name: string;
  base_unit: string;
  type: "ingredient" | "other";
  category_id: string;
  category_name: string;
  quantity_added: number;
};

export type OpeningStockEntry = {
  stock_item_id: string;
  name: string;
  base_unit: string;
  type: string;
  category_id: string;
  category_name: string;
  quantity_at_period_start: number;
};

export type MatchedProductEntry = {
  title: string;
  reference: string;
  category: string; // Vendus: pizza | bebida_alcoolica | bebida_nao_alcoolica | sacos | outros
  qty_sold: number;
  match_type: "pizza" | "stock";
  pizza_id?: string;
  size?: "small" | "large";
  stock_item_id?: string;
  stock_item_name?: string;
};

export type UnmatchedProductEntry = {
  title: string;
  reference: string;
  category: string;
  qty: number;
};

export type VendusSelfConsumptionRecord = {
  id?: string | number;
  consumption_datetime?: string;
  employee_name?: string;
  total?: number;
  observations?: string;
  products?: Array<{ reference: string; title: string; qty: number }>;
  [key: string]: unknown;
};

export type VendusSelfConsumptionSummary = {
  date_start?: string;
  date_end?: string;
  store_id?: number | null;
  total_spending?: number | null;
  records_count?: number;
  records?: VendusSelfConsumptionRecord[];
  details_fetched?: number;
  details_fetch_truncated?: boolean;
  pages_fetched?: number;
  error?: string;
};

export type IngredientConsumptionResponse = {
  period: {
    since: string;
    until: string;
    timezone?: string;
  };
  consumption: IngredientConsumptionEntry[];
  consumption_selfconsumption?: IngredientConsumptionEntry[];
  additions: StockAdditionEntry[];
  opening_stock?: OpeningStockEntry[];
  matched_products?: MatchedProductEntry[];
  vendus_selfconsumption?: VendusSelfConsumptionSummary;
  debug?: {
    products_total: number;
    products_matched: number;
    products_unmatched: number;
    unmatched_products: UnmatchedProductEntry[];
    took_ms: number;
    selfconsumption_lines_extracted?: number;
    selfconsumption_mapping_skipped?: string[];
  };
};
