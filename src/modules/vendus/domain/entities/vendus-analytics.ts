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
  channel: "salao" | "eatz";
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
  };
  grossRevenue: number;
}

export interface VendusTemporalPoint {
  period: string;
  documentCount: number;
  grossRevenue: number;
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
}

// ─── Summary result ───────────────────────────────────────────────────────────

export interface VendusSummaryResult {
  documents: VendusDetailedDocument[];
  analytics: VendusAnalytics;
}
