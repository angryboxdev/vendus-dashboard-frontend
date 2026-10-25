import { decToString, parseDecimal, resolveQuantity, toCents, type Dec } from "./decimal.ts";
import { computeHeaderOnlyDifference, computeInvoiceAmounts, type AmountLineInput, type InvoiceAmounts } from "./invoice-amounts.service.ts";
import type { AmountDiscountPayload, CreateInvoiceLinePayload, DocumentAmountsPayload, VatSummaryEntry } from "../entities/invoice.ts";

/**
 * Ponte entre o formulário de revisão e o motor único de valores (F1 §1.3).
 * Tudo em decimal exato: sem parseFloat no dinheiro. O servidor recalcula ao
 * finalizar com o mesmo motor — isto serve a pré-visualização e o payload.
 */

/** Número escrito pela pessoa: aceita vírgula ou ponto como decimal (nunca separador de milhares). */
export function parseTyped(text: string): Dec | null {
  const t = text.trim().replace(",", ".");
  if (!/\d/.test(t) || !/^-?\d*\.?\d*$/.test(t)) return null;
  return parseDecimal(t.startsWith(".") ? `0${t}` : t.replace(/^-\./, "-0."), ".");
}

export function typedToCents(text: string): number | null {
  const d = parseTyped(text);
  return d ? toCents(d) : null;
}

/** Texto para o servidor: vírgula decimal (lido sem ambiguidade, mantém todas as casas). */
export function toServerText(text: string): string | null {
  const d = parseTyped(text);
  return d ? decToString(d).replace(".", ",") : null;
}

/** Texto de um documento (vírgula decimal por omissão; ponto se for a única leitura válida). */
function parseDocument(text: string): Dec | null {
  return parseDecimal(text, ",") ?? parseDecimal(text, ".");
}

/** Preço unitário extraído → valor do campo (ponto decimal, todas as casas do documento). */
export function docPriceToField(unitPriceText: string | null | undefined, unitPriceCents: number | null | undefined, fallbackFromTotal?: { totalCents: number; quantity: number }): string {
  const fromText = unitPriceText ? parseDocument(unitPriceText) : null;
  if (fromText) return decToString(fromText);
  if (unitPriceCents != null) return decToString({ units: BigInt(Math.round(unitPriceCents)), scale: 2 });
  if (fallbackFromTotal && fallbackFromTotal.quantity > 0) {
    // Preço derivado do total da linha: 2 casas quando é exato (190,00 / 4 = 47,50); senão 6 casas,
    // para quantidade × preço voltar a dar o total ao cêntimo (100,00 / 3 → 33,333333).
    const unit = fallbackFromTotal.totalCents / 100 / fallbackFromTotal.quantity;
    const two = unit.toFixed(2);
    return Math.round(Number(two) * fallbackFromTotal.quantity * 100) === fallbackFromTotal.totalCents ? two : unit.toFixed(6);
  }
  return "";
}

/** Quantidade extraída → valor do campo: "20.000" resolve-se pelo bruto impresso; sem leitura única fica o número da IA. */
export function docQuantityToField(quantityText: string | null | undefined, quantity: number | null | undefined, price: string, grossCentsPrinted: number | null | undefined): string {
  const priceDec = parseTyped(price);
  if (quantityText && priceDec && grossCentsPrinted != null) {
    const q = resolveQuantity(quantityText, priceDec, grossCentsPrinted);
    if (q) return decToString(q);
  }
  // Sem bruto impresso para validar: «4,000» (só vírgula) lê-se à portuguesa = 4, nunca 4000.
  if (quantityText && /^\d+,\d+$/.test(quantityText.trim())) return String(Number(quantityText.trim().replace(",", ".")));
  return String(quantity ?? 1);
}

export interface DraftAmountLine {
  key: string;
  quantity: string;
  /** Preço unitário s/ IVA antes de desconto, em euros (texto decimal). */
  unitCost: string;
  /** "" = por validar (nunca se assume 0%). */
  vatRate: string;
  discountKind: "pct" | "amount";
  /** % ou euros, conforme `discountKind`; "" = sem desconto. */
  discountValue: string;
}

export interface DraftAmountHeader {
  totalStr: string;
  subtotalStr: string;
  vatStr: string;
  globalDiscountKind: "pct" | "amount";
  globalDiscountValue: string;
  /** Desconto impresso no rodapé, em euros ("" = nenhum). */
  footerDiscount: string;
  /** Ajustes documentados (portes, ecovalor…), em euros; podem ser negativos. */
  adjustments: string;
  /** Ajuste de arredondamento em cêntimos (0 = nenhum) e motivo. */
  roundingCents: number;
  roundingReason: string;
  /** Quadro de IVA do documento (null = não comparar). */
  vatSummary: VatSummaryEntry[] | null;
}

export function discountOf(kind: "pct" | "amount", value: string): AmountDiscountPayload | null {
  const d = parseTyped(value);
  if (!d || d.units <= 0n) return null;
  return kind === "pct" ? { kind: "pct", value: Number(decToString(d)) } : { kind: "amount", value: toCents(d) };
}

function lineInput(l: DraftAmountLine): AmountLineInput {
  const qty = parseTyped(l.quantity);
  const price = toServerText(l.unitCost);
  const rate = parseTyped(l.vatRate);
  return {
    id: l.key,
    quantity: qty ? Number(decToString(qty)) : 0,
    unitCostWithoutVat: typedToCents(l.unitCost) ?? 0,
    unitPriceText: price,
    discount: discountOf(l.discountKind, l.discountValue),
    vatRate: rate ? Number(decToString(rate)) : null,
  };
}

function roundingOf(h: DraftAmountHeader) {
  return h.roundingCents ? { cents: h.roundingCents, reason: h.roundingReason } : null;
}

/** Modo detalhado: linhas → bruto, descontos, base, IVA por taxa, total e diferença para a fatura. */
export function previewDetailed(h: DraftAmountHeader, lines: DraftAmountLine[]): InvoiceAmounts {
  const total = typedToCents(h.totalStr);
  return computeInvoiceAmounts(
    {
      totalWithVat: total ?? Number.NaN,
      globalDiscount: discountOf(h.globalDiscountKind, h.globalDiscountValue),
      footerDiscountCents: typedToCents(h.footerDiscount),
      adjustmentsCents: typedToCents(h.adjustments) ?? 0,
      vatSummary: h.vatSummary,
      roundingAdjustment: roundingOf(h),
    },
    lines.map(lineInput),
  );
}

/** Modo simples (sem linhas): base + IVA + ajustes = total. */
export function previewSimple(h: DraftAmountHeader) {
  return computeHeaderOnlyDifference({
    subtotalWithoutVat: typedToCents(h.subtotalStr) ?? 0,
    totalVat: typedToCents(h.vatStr) ?? 0,
    totalWithVat: typedToCents(h.totalStr) ?? 0,
    adjustmentsCents: typedToCents(h.adjustments) ?? 0,
    roundingAdjustment: roundingOf(h),
  });
}

export function amountsPayload(h: DraftAmountHeader, detailed: boolean): DocumentAmountsPayload {
  const rounding = roundingOf(h);
  return {
    ...(detailed && { globalDiscount: discountOf(h.globalDiscountKind, h.globalDiscountValue) }),
    ...(detailed && { footerDiscountCents: typedToCents(h.footerDiscount) }),
    ...(detailed && h.vatSummary && { vatSummary: h.vatSummary }),
    adjustmentsCents: typedToCents(h.adjustments) ?? 0,
    ...(rounding && { roundingAdjustment: rounding }),
  };
}

/** Campos de valor da linha para o payload (o servidor recalcula; IVA/total vêm da pré-visualização). */
export function lineValueFields(l: DraftAmountLine, preview: InvoiceAmounts | null): Pick<CreateInvoiceLinePayload, "quantity" | "unitCostWithoutVat" | "vatRate" | "vatAmount" | "totalWithVat" | "unitPriceText" | "discount"> {
  const input = lineInput(l);
  const net = preview?.lines.find((x) => x.id === l.key)?.netCents ?? 0;
  const vat = preview?.lineVatCents.get(l.key) ?? 0;
  return {
    quantity: input.quantity,
    unitCostWithoutVat: input.unitCostWithoutVat,
    vatRate: input.vatRate ?? 0,
    vatAmount: vat,
    totalWithVat: net + vat,
    unitPriceText: input.unitPriceText ?? null,
    discount: input.discount ?? null,
  };
}
