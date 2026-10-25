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

/** Classificação a gravar numa linha guardada, sem a apagar (só os campos que mudaram). */
export interface LineClassificationChange {
  lineId: string;
  type?: InvoiceLineType;
  costCenterCategoryId?: string | null;
  locationId?: string | null;
}

// O que define a linha (o mesmo critério do servidor ao manter linhas em Compras por rever).
const sameContent = (a: RestoredDraftLine, b: RestoredDraftLine) =>
  a.description.trim() === b.description.trim() &&
  Number(a.quantity) === Number(b.quantity) &&
  a.unit.trim() === b.unit.trim() &&
  Number(a.unitCost) === Number(b.unitCost) &&
  a.vatRate === b.vatRate &&
  (a.discountValue.trim() === "" && b.discountValue.trim() === "" ? true : a.discountKind === b.discountKind && Number(a.discountValue) === Number(b.discountValue));

/**
 * Editar uma fatura lançada: se as linhas são as mesmas que estão guardadas (mesmas linhas, pela ordem,
 * com a mesma descrição, quantidade, unidade, preço, IVA e desconto), devolve só as mudanças de
 * classificação (tipo, subcategoria, loja) — gravam-se sem apagar as linhas, que podem estar em
 * Compras por rever no Stock. Se alguma linha mudou, entrou ou saiu → `null` (substituir as linhas).
 */
export function classificationOnlyChanges(stored: RestoredDraftLine[], current: RestoredDraftLine[]): LineClassificationChange[] | null {
  if (stored.length !== current.length) return null;
  const changes: LineClassificationChange[] = [];
  for (let i = 0; i < stored.length; i++) {
    const s = stored[i]!;
    const c = current[i]!;
    if (s.key !== c.key || !sameContent(s, c)) return null;
    const change: LineClassificationChange = { lineId: s.key };
    if (c.type !== s.type) change.type = c.type;
    if (c.catId !== s.catId) change.costCenterCategoryId = c.catId || null;
    if (c.locationId !== s.locationId) change.locationId = c.locationId;
    if (Object.keys(change).length > 1) changes.push(change);
  }
  return changes;
}
