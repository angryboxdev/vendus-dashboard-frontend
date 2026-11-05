import { CATEGORY_ORDER, type CartLine, type Customer, type Discount, type PaymentMethod, type PosProduct } from "../entities/pos.ts";

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
  // A pesquisa passa por cima da categoria escolhida.
  if (q) return products.filter((p) => normalizeSearch(p.name).includes(q) || normalizeSearch(p.ref).includes(q));
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
