/** POS do Mezza — contrato com `/api/pos` (backend `src/modules/pos`). */

export type PaymentMethod = "card" | "cash" | "mbway";
export const PAYMENT_LABELS: Record<PaymentMethod, string> = { card: "Cartão", cash: "Dinheiro", mbway: "MB Way" };

export type Discount = { kind: "pct" | "eur"; value: number };

export interface PosProduct {
  id: string;
  ref: string;
  name: string;
  category: string | null;
  priceCents: number;
  vatRate: 6 | 13 | 23;
  productType: "P" | "S";
  trackStock: boolean;
  /** Stock do POS (pode ser negativo depois de «Vender na mesma»). */
  stockQty: number;
  barcode: string | null;
  imageUrl: string | null;
  active: boolean;
}

/** A = grelha com talão; B = lista com pesquisa. */
export type PosView = "A" | "B";

export interface PosSettings {
  invoiceSeriesRef: string | null;
  creditSeriesRef: string | null;
  managerEmployeeIds: string[];
  /** Vista por omissão para quem nunca escolheu (definida pelo gestor). */
  defaultView: PosView;
}

export interface PosEmployee {
  id: string;
  name: string;
  isManager: boolean;
  /** Vista lembrada do funcionário (ou a por omissão). */
  view?: PosView;
}

/** Movimento de stock do POS (venda, devolução, entrada, contagem) com o nome do produto. */
export interface StockMove {
  id: string;
  productId: string;
  productName: string;
  kind: "sale" | "refund" | "entry" | "count";
  qty: number;
  stockBefore: number;
  stockAfter: number;
  documentNumber: string | null;
  actorName: string | null;
  note: string | null;
  createdAt: string;
  /** Venda feita sem stock suficiente. */
  alert: boolean;
}

export interface StockDay {
  date: string;
  moves: StockMove[];
  alerts: StockMove[];
}

export const STOCK_MOVE_LABELS: Record<StockMove["kind"], string> = { sale: "Venda", refund: "Devolução", entry: "Entrada", count: "Contagem" };

export type StockAdjustment = { kind: "entry"; qty: number; note?: string } | { kind: "count"; countTo: number; note?: string };

export type ProductPatch = Partial<Pick<PosProduct, "name" | "category" | "priceCents" | "vatRate" | "active" | "trackStock" | "barcode">>;

export interface SoldLine {
  lineNumber: number;
  productId: string;
  ref: string;
  name: string;
  quantity: number;
  unitPriceCents: number;
  vatRate: number;
  totalCents: number;
}

export interface PosSale {
  id: string;
  kind: "sale" | "refund";
  documentId: string;
  documentNumber: string;
  employeeId: string;
  employeeName: string;
  paymentMethod: PaymentMethod;
  totalCents: number;
  givenCents: number | null;
  changeCents: number | null;
  refundOf: string | null;
  reason: string | null;
  lines: SoldLine[];
  createdAt: string;
}

export interface DaySummary {
  date: string;
  salesCount: number;
  salesCents: number;
  refundsCount: number;
  refundsCents: number;
  netCents: number;
  averageTicketCents: number;
  byPayment: Record<PaymentMethod, number>;
}

export interface ImportRow {
  line: number;
  ref: string;
  name: string;
  category: string | null;
  priceCents: number;
  vatRate: number | null;
  status: "import" | "skip";
  reason: string | null;
  warnings: string[];
}

export interface ImportPreview {
  rows: ImportRow[];
  toImport: number;
  skipped: number;
}

/** Linha do carrinho: produto, quantidade e desconto opcional. */
export interface CartLine {
  productId: string;
  quantity: number;
  discount?: Discount;
}

export interface Customer {
  taxId: string;
  name: string;
}

/** O documento fiscal para o talão (2.ª via do módulo de faturação). */
export interface ReceiptDocument {
  documentNumber: string;
  documentType: string;
  documentDate: string;
  systemEntryDate: string;
  atcud: string;
  qrPayload: string;
  issuer: { taxId: string; name: string; address: { street: string; postalCode: string; city: string } };
  customer: { taxId: string; name: string };
  lines: Array<{ lineNumber: number; productCode: string; description: string; quantity: string; unitPrice: string; discountPct: string | null; lineAmount: string; taxPercentage: string }>;
  taxes: Array<{ taxPercentage: string; taxableBase: string; taxAmount: string }>;
  netTotal: string;
  taxPayable: string;
  grossTotal: string;
  referencesTo: Array<{ documentNumber: string; reason?: string }>;
  statusReason: string | null;
  printed: { atcud: string; mentions: string[] };
}

/** Ordem das categorias do catálogo Angry Box no POS; as outras vêm a seguir, por ordem alfabética. */
export const CATEGORY_ORDER = ["Pequenas", "Grandes", "XS", "Entradas", "Menus", "Molhos Extras", "Bebidas", "Cervejas S", "Cervejas L", "Outros"];

export const formatEuros = (cents: number) =>
  `${(cents / 100).toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
