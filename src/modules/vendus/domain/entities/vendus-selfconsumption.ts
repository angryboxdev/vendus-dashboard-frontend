export interface VendusSelfConsumptionProduct {
  reference: string;
  title: string;
  qty: number;
  category: string;
}

export interface VendusSelfConsumptionRecord {
  id: string | number;
  datetime: string;
  employeeName: string;
  totalSpending: number;
  observations: string;
  products: VendusSelfConsumptionProduct[];
}

export interface VendusSelfConsumptionByEmployee {
  employeeName: string;
  recordCount: number;
  totalSpending: number;
}

export interface VendusSelfConsumptionByCategory {
  category: string;
  qty: number;
}

export interface VendusSelfConsumptionTopProduct {
  reference: string;
  title: string;
  category: string;
  qty: number;
}

export interface VendusSelfConsumptionAnalytics {
  totalSpending: number;
  recordCount: number;
  totalItemsConsumed: number;
  byEmployee: VendusSelfConsumptionByEmployee[];
  byCategory: VendusSelfConsumptionByCategory[];
  topProducts: VendusSelfConsumptionTopProduct[];
}

export interface VendusSelfConsumptionResult {
  records: VendusSelfConsumptionRecord[];
  analytics: VendusSelfConsumptionAnalytics;
}
