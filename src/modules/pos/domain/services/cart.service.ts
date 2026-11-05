import { CATEGORY_ORDER, type CartLine, type Customer, type Discount, type PaymentMethod, type PosProduct } from "../entities/pos.ts";

/** Indicador de stock: só nos artigos que controlam stock. ≤ 2 é baixo; 0 ou menos, sem stock. */
export type StockBadge = { tone: "ok" | "low" | "out"; label: string };

export function stockBadge(p: PosProduct): StockBadge | null {
  if (!p.trackStock) return null;
  if (p.stockQty < 0) return { tone: "out", label: `Stock −${-p.stockQty}` };
  if (p.stockQty === 0) return { tone: "out", label: "Sem stock" };
  return { tone: p.stockQty <= 2 ? "low" : "ok", label: `${p.stockQty} em stock` };
}

/** Artigos do talão com mais quantidade do que o stock (para o aviso antes de faturar). */
export function stockShortages(cart: CartLine[], products: Map<string, PosProduct>): Array<{ product: PosProduct; quantity: number; stock: number }> {
  const wanted = new Map<string, number>();
  for (const l of cart) wanted.set(l.productId, (wanted.get(l.productId) ?? 0) + l.quantity);
  return [...wanted.entries()].flatMap(([id, quantity]) => {
    const product = products.get(id);
    return product?.trackStock && quantity > product.stockQty ? [{ product, quantity, stock: product.stockQty }] : [];
  });
}

/** Produtos cujo stock mudou entre duas leituras (para o anel laranja de ~4 s). */
export function changedStock(before: PosProduct[], after: PosProduct[]): string[] {
  const old = new Map(before.map((p) => [p.id, p.stockQty]));
  return after.filter((p) => p.trackStock && old.has(p.id) && old.get(p.id) !== p.stockQty).map((p) => p.id);
}

/** Código lido ou escrito: o código de barras exato; senão a referência exata (sem maiúsculas). */
export function findByCode(products: PosProduct[], code: string): PosProduct | null {
  const c = code.trim();
  if (!c) return null;
  return products.find((p) => p.barcode === c) ?? products.find((p) => p.ref.toLowerCase() === c.toLowerCase()) ?? null;
}

/**
 * Leitor de código de barras (funciona como teclado): caracteres seguidos a
 * menos de `SCAN_GAP_MS` e Enter no fim. Uma pessoa a escrever é mais lenta,
 * por isso não dispara. Puro: recebe a tecla e o instante, devolve o estado.
 */
export const SCAN_GAP_MS = 50;
export type ScanState = { buffer: string; lastAt: number };
export const EMPTY_SCAN: ScanState = { buffer: "", lastAt: 0 };

export function scanKey(state: ScanState, key: string, at: number): { state: ScanState; code: string | null } {
  const fast = state.buffer !== "" && at - state.lastAt <= SCAN_GAP_MS;
  if (key === "Enter") return { state: EMPTY_SCAN, code: fast && state.buffer.length >= 4 ? state.buffer : null };
  if (key.length !== 1) return { state: EMPTY_SCAN, code: null };
  return { state: { buffer: fast ? state.buffer + key : key, lastAt: at }, code: null };
}

/**
 * Carrinho do POS: operações puras e o total com a MESMA regra do backend
 * (`src/modules/pos/domain/services/sale-pricing.service.ts`): o total no ecrã
 * é o total da fatura, ao cêntimo — o troco nunca falha por um cêntimo.
 */

export function addProduct(cart: CartLine[], productId: string): CartLine[] {
  const i = cart.findIndex((l) => l.productId === productId);
  if (i < 0) return [...cart, { productId, quantity: 1 }];
  return cart.map((l, j) => (j === i ? { ...l, quantity: Math.min(l.quantity + 1, 999) } : l));
}

export function changeQuantity(cart: CartLine[], productId: string, delta: number): CartLine[] {
  return cart.flatMap((l) => (l.productId !== productId ? [l] : l.quantity + delta <= 0 ? [] : [{ ...l, quantity: Math.min(l.quantity + delta, 999) }]));
}

export function setLineDiscount(cart: CartLine[], productId: string, discount: Discount | null): CartLine[] {
  return cart.map((l) => {
    if (l.productId !== productId) return l;
    return discount && discount.value > 0 ? { ...l, discount } : { productId: l.productId, quantity: l.quantity };
  });
}

function discountCents(baseCents: number, d: Discount | undefined): number {
  if (!d || !(d.value > 0)) return 0;
  if (d.kind === "pct") return Math.round((baseCents * Math.min(d.value, 100)) / 100);
  return Math.min(Math.round(d.value * 100), baseCents);
}

/** Maior resto, empates pela ordem das linhas — igual ao `distribute` do kernel do backend. */
export function distribute(total: number, weights: number[]): number[] {
  const W = BigInt(weights.reduce((a, b) => a + b, 0));
  if (!W || !total) return weights.map(() => 0);
  const T = BigInt(total);
  const parts = weights.map((w, i) => ({ i, q: (T * BigInt(w)) / W, r: (T * BigInt(w)) % W }));
  let left = T - parts.reduce((a, p) => a + p.q, 0n);
  for (const p of [...parts].sort((a, b) => (b.r > a.r ? 1 : b.r < a.r ? -1 : a.i - b.i))) {
    if (left <= 0n) break;
    p.q += 1n;
    left -= 1n;
  }
  return parts.map((p) => Number(p.q));
}

export interface PricedCartLine {
  line: CartLine;
  product: PosProduct;
  grossCents: number;
  /** Total da linha só com o desconto da linha. */
  netCents: number;
  /** Total final da linha (com a parte do desconto na venda). */
  totalCents: number;
}

export interface PricedCart {
  lines: PricedCartLine[];
  subtotalCents: number;
  saleDiscountCents: number;
  totalCents: number;
  /** Base e IVA por taxa (preços com IVA). */
  vat: Array<{ rate: number; baseCents: number; vatCents: number }>;
}

export function priceCart(cart: CartLine[], products: Map<string, PosProduct>, saleDiscount?: Discount): PricedCart {
  const rows = cart.flatMap((line) => {
    const product = products.get(line.productId);
    if (!product) return [];
    const grossCents = product.priceCents * line.quantity;
    return [{ line, product, grossCents, netCents: grossCents - discountCents(grossCents, line.discount) }];
  });
  const subtotalCents = rows.reduce((s, r) => s + r.netCents, 0);
  const saleDiscountCents = discountCents(subtotalCents, saleDiscount);
  const cuts = saleDiscountCents > 0 ? distribute(saleDiscountCents, rows.map((r) => r.netCents)) : rows.map(() => 0);
  const lines = rows.map((r, i) => ({ ...r, totalCents: r.netCents - cuts[i]! }));
  const byRate = new Map<number, number>();
  for (const l of lines) byRate.set(l.product.vatRate, (byRate.get(l.product.vatRate) ?? 0) + l.totalCents);
  const vat = [...byRate.entries()]
    .sort(([a], [b]) => a - b)
    .map(([rate, gross]) => {
      const vatCents = Math.round((gross * rate) / (100 + rate));
      return { rate, baseCents: gross - vatCents, vatCents };
    });
  return { lines, subtotalCents, saleDiscountCents, totalCents: subtotalCents - saleDiscountCents, vat };
}

/** Valores rápidos para o dinheiro entregue: o total certo, e os arredondamentos a 1, 5, 10, 20, 50, 100 e 200 € — os 4 primeiros distintos. */
export function quickCashAmounts(totalCents: number): number[] {
  if (totalCents <= 0) return [];
  const steps = [100, 500, 1000, 2000, 5000, 10000, 20000];
  const out = new Set<number>([totalCents]);
  for (const s of steps) out.add(Math.ceil(totalCents / s) * s);
  return [...out].sort((a, b) => a - b).slice(0, 4);
}

/** Pesquisa sem maiúsculas nem acentos, por nome ou referência. */
export const normalizeSearch = (v: string) =>
  v
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

export function searchProducts(products: PosProduct[], query: string, category: string | null): PosProduct[] {
  const q = normalizeSearch(query);
  // A pesquisa passa por cima da categoria escolhida; o código exato (leitor) vem primeiro.
  if (q) {
    const exact = findByCode(products, query);
    const found = products.filter((p) => p !== exact && (normalizeSearch(p.name).includes(q) || normalizeSearch(p.ref).includes(q) || (p.barcode ?? "").includes(q)));
    return exact ? [exact, ...found] : found;
  }
  return category ? products.filter((p) => (p.category ?? "Outros") === category) : products;
}

export function categoriesOf(products: PosProduct[]): string[] {
  const present = new Set(products.map((p) => p.category ?? "Outros"));
  const known = CATEGORY_ORDER.filter((c) => present.has(c));
  const others = [...present].filter((c) => !CATEGORY_ORDER.includes(c)).sort((a, b) => a.localeCompare(b, "pt"));
  return [...known, ...others];
}

/** Teclado de dinheiro: dígitos em cêntimos («7» «5» → 0,75 €). */
export function keypadPress(currentCents: number, key: string): number {
  if (key === "back") return Math.floor(currentCents / 10);
  if (key === "clear") return 0;
  if (!/^\d{1,2}$/.test(key)) return currentCents;
  const next = Number(`${currentCents}${key}`);
  return next > 99_999_99 ? currentCents : next;
}

export interface PaymentState {
  method: PaymentMethod | null;
  givenCents: number;
  customer: Customer;
}

export const EMPTY_PAYMENT: PaymentState = { method: null, givenCents: 0, customer: { taxId: "", name: "" } };

/** Pode confirmar: método escolhido e, em dinheiro, entregue ≥ total. */
export const paymentReady = (p: PaymentState, totalCents: number) => p.method !== null && (p.method !== "cash" || p.givenCents >= totalCents);
