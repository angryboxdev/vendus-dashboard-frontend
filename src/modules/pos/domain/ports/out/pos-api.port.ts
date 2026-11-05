import type { CartLine, Customer, DaySummary, Discount, ImportPreview, PaymentMethod, PosEmployee, PosProduct, PosSale, PosSettings, ReceiptDocument } from "../../entities/pos.ts";

export interface SeriesOption {
  ref: string;
  documentType: string;
  seriesId: string;
  mode: "training" | "normal";
  validationCode: string | null;
}

export interface CheckoutRequest {
  pin: string;
  lines: CartLine[];
  saleDiscount?: Discount;
  payment: { method: PaymentMethod; givenCents?: number };
  customer: Customer | null;
}

/** API do POS (`/api/pos`) e a 2.ª via do documento (`/api/invoicing/documents/:id`). */
export interface PosApiPort {
  products(activeOnly: boolean): Promise<PosProduct[]>;
  updateProduct(id: string, patch: Partial<Pick<PosProduct, "name" | "category" | "priceCents" | "vatRate" | "active">>): Promise<PosProduct>;
  previewImport(csv: string): Promise<ImportPreview>;
  importProducts(csv: string): Promise<{ created: number; updated: number; skipped: number }>;
  settings(): Promise<PosSettings>;
  saveSettings(s: PosSettings): Promise<PosSettings>;
  employees(): Promise<PosEmployee[]>;
  series(): Promise<SeriesOption[]>;
  login(pin: string): Promise<PosEmployee>;
  /** A mesma chave num reenvio devolve a mesma venda — nunca uma segunda fatura. */
  checkout(req: CheckoutRequest, idempotencyKey: string): Promise<PosSale>;
  refund(saleId: string, req: { pin: string; lines: Array<{ lineNumber: number; quantity: number }>; reason: string }, idempotencyKey: string): Promise<PosSale>;
  documents(date?: string): Promise<PosSale[]>;
  summary(date?: string): Promise<DaySummary>;
  receipt(documentId: string): Promise<ReceiptDocument>;
}

export interface PosIdGeneratorPort {
  next(): string;
}
