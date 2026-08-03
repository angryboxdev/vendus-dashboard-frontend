import type { AirMenuOrder } from "./air-menu-order.ts";

export interface AirMenuAnalyticsData {
  summary: {
    totalOrders: number;
    cancellationRate: number;
    grossRevenue: number;
    vatCollected: number;
    netRevenue: number;
    averageTicket: number;
  };
  byPlatform: Array<{
    platform: string;
    orderCount: number;
    cancellationCount: number;
    grossRevenue: number;
    vatCollected: number;
    netRevenue: number;
    averageTicket: number;
  }>;
  byCategory: Array<{
    category: string;
    itemsSold: number;
    grossRevenue: number;
    vatCollected: number;
    netRevenue: number;
    subcategories: Array<{
      category: string;
      itemsSold: number;
      grossRevenue: number;
      vatCollected: number;
      netRevenue: number;
    }>;
  }>;
  byVatRate: Array<{
    rate: number;
    grossRevenue: number;
    vatAmount: number;
    netRevenue: number;
  }>;
  byDocumentType: {
    invoices: { count: number; grossRevenue: number };
    creditNotes: { count: number; grossRevenue: number };
  };
  topItems: Array<{
    plu: string;
    title: string;
    category: string;
    vatRate: number;
    quantitySold: number;
    grossRevenue: number;
  }>;
  temporalDistribution: Array<{
    period: string;
    orderCount: number;
    grossRevenue: number;
  }>;
}

export interface AirMenuSummaryData {
  orders: AirMenuOrder[];
  analytics: AirMenuAnalyticsData;
}
