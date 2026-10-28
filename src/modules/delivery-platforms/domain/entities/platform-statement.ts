/**
 * Extratos das plataformas de delivery — contrato de `POST /api/delivery-platforms/import` e
 * `GET /api/delivery-platforms/statements` (módulo backend `delivery-platforms`). Valores em cêntimos, com IVA.
 */
export type DeliveryPlatform = "uber_eats" | "glovo" | "bolt_food";

/** Extrato importado, com os totais por natureza (reduções positivas). */
export interface PlatformStatementSummary {
  id: string;
  platform: DeliveryPlatform;
  documentNumber: string;
  periodFrom: string;
  periodTo: string;
  issuedOn: string | null;
  ordersCount: number | null;
  salesCents: number;
  promotionsCents: number;
  commissionCents: number;
  marketingCents: number;
  otherFeesCents: number;
  refundsCents: number;
  /** Pago pelos clientes em dinheiro ao estafeta (não passa pela transferência). */
  cashCents: number;
  /** IVA contido nas comissões, marketing e outras taxas. */
  feesVatCents: number;
  netPayoutCents: number;
  fileName: string;
  importedAt: string;
}

export interface ImportedPlatformDocument {
  fileName: string;
  platform: DeliveryPlatform;
  documentNumber: string;
  periodFrom: string;
  periodTo: string;
  netPayoutCents: number;
  /** Já existia um extrato com o mesmo número: foi substituído. */
  replaced: boolean;
}

export interface ImportPlatformDocumentsResult {
  imported: ImportedPlatformDocument[];
  rejected: { fileName: string; reason: string }[];
}

/** Ficheiro escolhido no browser, já lido. */
export interface PlatformDocumentUpload {
  name: string;
  content: ArrayBuffer;
}
