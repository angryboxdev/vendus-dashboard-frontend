import type { DeliveryPlatform, PlatformDocumentKind } from "./platform-statement.ts";

/**
 * Relatório de margem por plataforma — contrato de `GET /api/delivery-platforms/report` (backend
 * `delivery-platforms`, F3). Cêntimos; percentagens sobre as vendas sem IVA.
 */
export type AllocationBasis = "month" | "daily" | "orders" | "saft" | "days";

export interface AllocatedDocument {
  platform: DeliveryPlatform;
  documentKind: PlatformDocumentKind;
  documentNumber: string;
  periodFrom: string;
  periodTo: string;
  /** Parte do documento que pertence ao mês (0–1). */
  share: number;
  basis: AllocationBasis;
}

export interface PlatformMargin {
  platform: Exclude<DeliveryPlatform, "airmenu"> | "total";
  documents: number;
  ordersCount: number;
  salesGrossCents: number;
  promotionsGrossCents: number;
  paidByCustomersCents: number;
  platformFeesGrossCents: number;
  feesVatCents: number;
  cashCents: number;
  netPayoutCents: number;
  salesNetCents: number;
  promotionsNetCents: number;
  invoicedNetCents: number;
  salesVatCents: number;
  commissionNetCents: number;
  marketingNetCents: number;
  otherNetCents: number;
  grossMarginCents: number;
  grossMarginPct: number | null;
  foodCostCents: number;
  netMarginCents: number;
  netMarginPct: number | null;
  netMarginPerOrderCents: number | null;
  vatToPayCents: number;
}

export interface MarginReport {
  period: { year: number; month: number; from: string; to: string };
  salesVatRate: number;
  salesVatRateSource: "saft" | "default";
  foodCostPct: number;
  platforms: PlatformMargin[];
  total: PlatformMargin;
  saft: { invoicedCents: number; platformsPaidCents: number; differenceCents: number } | null;
  documents: AllocatedDocument[];
  warnings: string[];
}

export type MarginReportFormat = "xlsx" | "pdf";

export interface DownloadedFile {
  fileName: string;
  content: Blob;
}
