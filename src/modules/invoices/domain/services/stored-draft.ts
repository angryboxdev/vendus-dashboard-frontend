import type { InvoiceLineDTO, InvoiceLineType, StoredAmountsDTO } from "../entities/invoice.ts";
import { docPriceToField } from "./draft-amounts.ts";

/**
 * Reabrir um rascunho gravado (F2 v1.2 §2.2): reconstrói o formulário de
 * revisão a partir das linhas reais e dos valores gravados (`storedAmounts`)
 * — preço com o texto original, descontos % ou €, subcategoria, loja, tipo e
 * unidade — em vez de recomeçar sem linhas.
 */
export interface RestoredDraftLine {
  key: string;
  description: string;
  type: InvoiceLineType;
  quantity: string;
  unit: string;
  unitCost: string;
  vatRate: string;
  discountKind: "pct" | "amount";
  discountValue: string;
  catId: string;
  locationId: string | null;
}

export interface RestoredDraftHeader {
  globalDiscountKind: "pct" | "amount";
  globalDiscountValue: string;
  footerDiscount: string;
  adjustments: string;
  roundingReason: string;
  /** Havia ajuste de arredondamento gravado → reativar o interruptor. */
  roundingOn: boolean;
}

/** % fica como escrito; € (cêntimos) passa a euros com 2 casas. */
function discountField(kind: "pct" | "amount" | null, value: number | null): { kind: "pct" | "amount"; value: string } {
  if (kind === null || value === null || value === 0) return { kind: "pct", value: "" };
  return { kind, value: kind === "pct" ? String(value) : (Math.abs(value) / 100).toFixed(2) };
}

const centsField = (c: number | null | undefined) => (c ? (c / 100).toFixed(2) : "");

export function restoreDraftLines(lines: InvoiceLineDTO[], stored: StoredAmountsDTO | null | undefined): RestoredDraftLine[] {
  const byLine = new Map((stored?.lines ?? []).map((s) => [s.lineId, s]));
  return lines.map((l) => {
    const s = byLine.get(l.id);
    const discount = discountField(s?.discountKind ?? null, s?.discountValue ?? null);
    return {
      key: l.id,
      description: l.description,
      type: l.type,
      // Notas de crédito guardam valores negativos; o formulário mostra a magnitude.
      quantity: String(Math.abs(l.quantity)),
      unit: l.unit ?? "",
      unitCost: docPriceToField(s?.unitPriceText ?? null, Math.abs(l.unitCostWithoutVat)),
      vatRate: String(l.vatRate),
      discountKind: discount.kind,
      discountValue: discount.value,
      catId: l.costCenterCategoryId ?? "",
      locationId: l.locationId,
    };
  });
}

export function restoreDraftHeader(stored: StoredAmountsDTO | null | undefined): RestoredDraftHeader | null {
  if (!stored) return null;
  const global = discountField(stored.globalDiscountKind, stored.globalDiscountValue);
  return {
    globalDiscountKind: global.kind,
    globalDiscountValue: global.value,
    footerDiscount: centsField(stored.footerDiscountCents),
    adjustments: centsField(stored.adjustmentsCents),
    roundingReason: stored.roundingAdjustmentReason ?? "",
    roundingOn: stored.roundingAdjustmentCents !== 0,
  };
}
