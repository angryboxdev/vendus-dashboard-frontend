// ─── Channels & Categories ────────────────────────────────────────────────────

export type UnifiedChannel =
  | "salao"
  | "take_away"
  | "eatz"
  | "uber_eats"
  | "glovo"
  | "bolt_food"
  | "apps";

export type UnifiedCategory =
  | "Pizzas"
  | "Bebidas Alcoólicas"
  | "Bebidas"
  | "Outros";

// ─── Totals ───────────────────────────────────────────────────────────────────

export interface SalesSummaryTotals {
  /** Invoices minus NC, with VAT (cents). */
  grossRevenue: number;
  /** All invoices before NC subtraction (cents). */
  faturadoTotal: number;
  /** VAT collected on invoices (cents). */
  vatCollected: number;
  /** grossRevenue minus vatCollected (cents). */
  netRevenue: number;
  /** Invoice count (NC excluded). */
  transactionCount: number;
  /** grossRevenue / transactionCount (cents). */
  averageTicket: number;
  creditNoteCount: number;
  /** Positive absolute value of credit notes (cents). */
  creditNoteValue: number;
}

// ─── Breakdowns ───────────────────────────────────────────────────────────────

export interface ChannelSummary {
  channel: UnifiedChannel;
  grossRevenue: number;
  transactionCount: number;
  averageTicket: number;
  sharePercent: number;
}

export interface CategorySummary {
  category: UnifiedCategory;
  itemsSold: number;
  grossRevenue: number;
  vatCollected: number;
  netRevenue: number;
}

export interface ProductRanking {
  normalizedTitle: string;
  quantitySold: number;
  grossRevenue: number;
  channels: UnifiedChannel[];
}

export interface TimeBucket {
  hour: number;
  invoiceCount: number;
  creditNoteCount: number;
  grossRevenue: number;
}

// ─── Full result ──────────────────────────────────────────────────────────────

export interface SalesSummaryResult {
  period: { year: number; month: number };
  /** ISO 8601 string (JSON-serialised Date from backend). */
  cachedAt: string;
  totals: SalesSummaryTotals;
  byChannel: ChannelSummary[];
  byCategory: CategorySummary[];
  /** Top 50, ordered by grossRevenue descending. */
  topProducts: ProductRanking[];
  temporalDistribution: TimeBucket[];
}

// ─── Growth chart ─────────────────────────────────────────────────────────────

export interface MonthlyGrowthPoint {
  year: number;
  month: number;
  vendusRevenue: number;
  airMenuRevenue: number;
  totalRevenue: number;
  cachedAt: string | null;
}

// ─── Period ───────────────────────────────────────────────────────────────────

export interface SalesPeriod {
  year: number;
  month: number;
}

export function currentPeriod(): SalesPeriod {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

export function prevMonth(p: SalesPeriod): SalesPeriod {
  if (p.month === 1) return { year: p.year - 1, month: 12 };
  return { year: p.year, month: p.month - 1 };
}
