import type { CartLine, Customer, DaySummary, Discount, ImportPreview, PaymentMethod, PosEmployee, PosProduct, PosSale, PosSettings, ReceiptDocument } from "../../entities/pos.ts";
import type { SeriesOption } from "../out/pos-api.port.ts";

export type CheckoutOutcome = { kind: "done"; sale: PosSale } | { kind: "invalid"; errors: string[] };

/** Casos de uso do POS no ecrã. */
export interface PosPort {
  products(activeOnly: boolean): Promise<PosProduct[]>;
  updateProduct(id: string, patch: Partial<Pick<PosProduct, "name" | "category" | "priceCents" | "vatRate" | "active">>): Promise<PosProduct>;
  previewImport(csv: string): Promise<ImportPreview>;
  importProducts(csv: string): Promise<{ created: number; updated: number; skipped: number }>;
  settings(): Promise<PosSettings>;
  saveSettings(s: PosSettings): Promise<PosSettings>;
  employees(): Promise<PosEmployee[]>;
  series(): Promise<SeriesOption[]>;
  login(pin: string): Promise<PosEmployee>;
  /**
   * Cobra e fatura. `attemptKey` identifica o pedido: repetir depois de uma falha
   * de rede com a mesma chave nunca emite uma segunda fatura.
   */
  checkout(
    q: { pin: string; lines: CartLine[]; saleDiscount?: Discount; payment: { method: PaymentMethod; givenCents?: number }; customer: Customer | null; totalCents: number },
    attemptKey: string,
  ): Promise<CheckoutOutcome>;
  newAttemptKey(): string;
  refund(saleId: string, q: { pin: string; lines: Array<{ lineNumber: number; quantity: number }>; reason: string }): Promise<PosSale>;
  documents(date?: string): Promise<PosSale[]>;
  summary(date?: string): Promise<DaySummary>;
  receipt(documentId: string): Promise<ReceiptDocument>;
}
