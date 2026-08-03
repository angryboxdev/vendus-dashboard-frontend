export interface AirMenuOrderItem {
  title: string;
  price: number;
  count: number;
}

export interface AirMenuFlag {
  key: string;
  operator: string;
}

export type AirMenuDocumentType = "invoice" | "credit_note";

export interface AirMenuOrder {
  orderId: string;
  platform: string;
  divisionName: string;
  orderDate: Date;
  documentDate: Date;
  paymentMethod: string;
  items: AirMenuOrderItem[];
  total: number;
  firstName: string;
  lastName: string;
  activeFlags: AirMenuFlag[];
  providerOrderId: string | null;
  documentType: AirMenuDocumentType;
  extraInfo: Record<string, string>;
  rawData?: Record<string, unknown>[];
}
