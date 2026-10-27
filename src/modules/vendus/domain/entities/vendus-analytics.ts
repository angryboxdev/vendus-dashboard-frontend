import type { VendusDetailedDocument } from "./vendus-document.ts";

// ─── Analytics sub-types ──────────────────────────────────────────────────────

export interface VendusSummaryStats {
  totalDocuments: number;
  totalCreditNotes: number;
  grossRevenue: number;
  vatCollected: number;
  netRevenue: number;
  averageTicket: number;
}

export interface VendusChannelStats {
  channel: "salao" | "eatz" | "apps";
  documentCount: number;
  creditNoteCount: number;
  grossRevenue: number;
  vatCollected: number;
  netRevenue: number;
  averageTicket: number;
  takeAwayCount: number;
}

export interface VendusCategoryStats {
  category: string;
  quantitySold: number;
  grossRevenue: number;
  vatCollected: number;
  netRevenue: number;
}

export interface VendusVatRateStats {
  rate: number;
  grossRevenue: number;
  vatAmount: number;
  netRevenue: number;
}

export interface VendusTopProduct {
  reference: string;
  title: string;
  category: string;
  vatRate: number;
  quantitySold: number;
  grossRevenue: number;
}

export interface VendusProductChannelBreakdown {
  reference: string;
  title: string;
  category: string;
  vatRate: number;
  quantitySold: number;
  byChannel: {
    salao: number;
    take_away: number;
    eatz: number;
    apps: number;
  };
  grossRevenue: number;
}

export interface VendusTemporalPoint {
  period: string;
  documentCount: number;
  grossRevenue: number;
}

// ─── By payment method ───────────────────────────────────────────────────────

/** Classe do método de pagamento — 'card' ↔ créditos TPA, 'cash' ↔ depósitos em numerário. */
export type VendusPaymentKind = "cash" | "card" | "eatz" | "apps" | "other";

/** Total por método de pagamento (título da Vendus). NC subtraem. */
export interface VendusPaymentMethodStats {
  paymentId: number;
  title: string;
  kind: VendusPaymentKind;
  documentCount: number;
  amount: number;
}

/** Totais de um dia ('YYYY-MM-DD') por classe de pagamento. NC subtraem. */
export interface VendusDailyPayments {
  date: string;
  cash: number;
  card: number;
  eatz: number;
  apps: number;
  other: number;
  total: number;
}

// ─── Full analytics ───────────────────────────────────────────────────────────

export interface VendusAnalytics {
  summary: VendusSummaryStats;
  byChannel: VendusChannelStats[];
  byCategory: VendusCategoryStats[];
  byVatRate: VendusVatRateStats[];
  byDocumentType: {
    invoices: { count: number; grossRevenue: number };
    creditNotes: { count: number; grossRevenue: number };
  };
  topProducts: VendusTopProduct[];
  productsByChannel: VendusProductChannelBreakdown[];
  temporalDistribution: VendusTemporalPoint[];
  byPaymentMethod: VendusPaymentMethodStats[];
  dailyPayments: VendusDailyPayments[];
}

// ─── Summary result ───────────────────────────────────────────────────────────

export interface VendusSummaryResult {
  documents: VendusDetailedDocument[];
  analytics: VendusAnalytics;
}
