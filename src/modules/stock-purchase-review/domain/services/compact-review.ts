/**
 * Lista compacta da conciliação (task V5 §2): agrupamento só visual das linhas que vão para o mesmo
 * artigo, estado de cada linha, indicadores e filtros. Sem I/O. O agrupamento nunca junta linhas no
 * servidor: cada linha da fatura (lote, desconto, IVA) continua individual.
 */
import type { StockPurchaseReviewDTO, StockReviewLineDTO } from "../entities/stock-purchase-review.ts";
import { invoiceQuantityUnit, plural, unitFactor } from "./presentation.ts";

export type CompactState = "resolved" | "confirm" | "review" | "out";

export const COMPACT_STATE_LABELS: Record<CompactState, string> = {
  resolved: "Resolvido",
  confirm: "Confirmar",
  review: "Por rever",
  out: "Fora do Stock",
};

export type CompactFilter = "all" | "pending" | "stock" | "out";

export interface CompactRow {
  key: string;
  /** Linhas da fatura nesta linha da lista (2 no Cheddar de dois lotes). */
  lines: StockReviewLineDTO[];
  label: string;
  reference: string | null;
  state: CompactState;
  /** «40 kg», «6 + 1 kg», «4 un». */
  invoiced: string;
  /** Entrada prevista na unidade do artigo (não é movimento realizado); null sem conversão. */
  expected: { quantity: number; unit: string } | null;
  netCents: number;
}

const qty = (n: number) => n.toLocaleString("pt-PT", { maximumFractionDigits: 3 });
const isStock = (l: StockReviewLineDTO) => l.resolutionType === "existing_item" || l.resolutionType === "new_item";
const netOf = (l: StockReviewLineDTO) => l.netAmount ?? (l.vatAmount != null ? l.totalWithVat - l.vatAmount : l.totalWithVat);

/** Proposta completa (artigo + fator) pronta a aceitar num clique. */
export function hasCompleteSuggestion(l: StockReviewLineDTO): boolean {
  const s = l.suggestion;
  if (!s || s.source === "none" || !s.resolution) return false;
  if (s.resolution === "no_stock_effect") return true;
  return !!s.stockItemId && s.conversionFactor != null && s.conversionFactor > 0;
}

export function compactState(l: StockReviewLineDTO): CompactState {
  if (l.resolutionType === "no_stock_effect") return "out";
  if (isStock(l)) return "resolved";
  return hasCompleteSuggestion(l) ? "confirm" : "review";
}

/** Unidade em que a fatura conta a linha (kg pela descrição, ou a unidade da linha). */
export function invoicedUnit(l: StockReviewLineDTO): string {
  return invoiceQuantityUnit(l.purchaseUnit, l.description) ?? l.purchaseUnit;
}

/**
 * Linhas resolvidas para o mesmo artigo e na mesma unidade faturada juntam-se numa linha da lista
 * (ordem da fatura); por rever e fora do Stock ficam uma a uma.
 */
export function compactRows(review: StockPurchaseReviewDTO, itemName: (id: string) => { name: string; baseUnit: string } | undefined): CompactRow[] {
  const rows: CompactRow[] = [];
  const byItem = new Map<string, CompactRow>();
  for (const l of review.lines) {
    const state = compactState(l);
    const item = l.stockItemId ? itemName(l.stockItemId) : undefined;
    const unit = invoicedUnit(l);
    const groupKey = state === "resolved" && l.stockItemId ? `${l.stockItemId}|${unit}` : null;
    const existing = groupKey ? byItem.get(groupKey) : undefined;
    if (existing) {
      existing.lines.push(l);
      continue;
    }
    const row: CompactRow = { key: l.id, lines: [l], label: state === "resolved" && item ? item.name : l.description, reference: l.supplierItemCode, state, invoiced: "", expected: null, netCents: 0 };
    rows.push(row);
    if (groupKey) byItem.set(groupKey, row);
  }
  for (const row of rows) {
    const unit = invoicedUnit(row.lines[0]!);
    row.invoiced = `${row.lines.map((l) => qty(l.purchaseQuantity)).join(" + ")} ${unit}`;
    row.netCents = row.lines.reduce((s, l) => s + netOf(l), 0);
    const first = row.lines[0]!;
    const baseUnit = (first.stockItemId ? itemName(first.stockItemId)?.baseUnit : undefined) ?? first.packaging?.baseUnit ?? null;
    if (row.state === "resolved" && baseUnit && row.lines.every((l) => l.stockQuantity != null)) {
      row.expected = { quantity: row.lines.reduce((s, l) => s + (l.stockQuantity ?? 0), 0), unit: baseUnit };
    }
  }
  return rows;
}

export interface CompactKpis {
  documentLines: number;
  /** Artigos distintos já resolvidos para Stock (o Cheddar de dois lotes conta uma vez). */
  stockItems: number;
  netCents: number | null;
  totalCents: number | null;
  vatCents: number | null;
  pending: number;
}

export function compactKpis(review: StockPurchaseReviewDTO): CompactKpis {
  const stockIds = new Set(review.lines.filter(isStock).map((l) => l.stockItemId).filter(Boolean));
  return {
    documentLines: review.lines.length,
    stockItems: stockIds.size,
    netCents: review.invoiceNetCents ?? null,
    totalCents: review.invoiceTotalCents ?? null,
    vatCents: review.invoiceVatCents ?? null,
    pending: review.lines.filter((l) => l.resolutionType === "unresolved").length,
  };
}

export function matchesFilter(row: CompactRow, filter: CompactFilter): boolean {
  if (filter === "all") return true;
  if (filter === "pending") return row.state === "confirm" || row.state === "review";
  if (filter === "stock") return row.state === "resolved";
  return row.state === "out";
}

/** Ordem V4: Artigos para Stock → Por rever → Fora do Stock (dentro de cada grupo, a ordem da fatura). */
export function sortRows(rows: CompactRow[]): CompactRow[] {
  const rank: Record<CompactState, number> = { resolved: 0, confirm: 1, review: 1, out: 2 };
  return rows.map((r, i) => ({ r, i })).sort((a, b) => rank[a.r.state] - rank[b.r.state] || a.i - b.i).map((x) => x.r);
}

const PACK_WORDS = "saco|sacos|bolsa|bolsas|caixa|caixas|cx|lata|latas|garrafa|garrafas|balde|baldes|emb|embalagem|embalagens|pack|frasco|frascos|garrafao|garrafão";

/** Tamanho e tipo de embalagem escritos na descrição: «5 kg bolsa» → { 5 kg, bolsa }; «… 1 kg» → { 1 kg }. */
function packFromDescription(description: string): { quantity: number; unit: string; packageUnit: string | null } | null {
  const t = description.toLowerCase();
  const m = t.match(new RegExp(String.raw`(\d+(?:[.,]\d+)?)\s*(kg|gr|g|lt|l|ml|cl)\b(?:\s+(${PACK_WORDS})\b)?`));
  if (!m) return null;
  const before = t.match(new RegExp(String.raw`\b(${PACK_WORDS})\b[^\d]*\d`));
  const unit = m[2] === "gr" ? "g" : m[2] === "lt" ? "l" : m[2]!;
  return { quantity: Number(m[1]!.replace(",", ".")), unit, packageUnit: (m[3] ?? before?.[1] ?? null)?.replace(/s$/, "") ?? null };
}

const eurDoc = (cents: number) => (cents / 100).toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 4 });

/**
 * Como a linha aparece na fatura, para conferir (V5): «16 sacos × 2,5 kg = 40 kg» quando a embalagem é
 * conhecida (confirmada ou escrita na descrição); senão «40 kg × 6,20 €». Só informação — não decide nada.
 */
export function invoiceBreakdown(l: StockReviewLineDTO): string {
  const unit = invoicedUnit(l);
  const q = l.purchaseQuantity;
  const pres = l.packaging?.presentation ?? null;
  const packages = l.packaging?.preview?.packages ?? null;
  if (pres?.packageUnit && packages != null) {
    // Conteúdo na unidade em que a fatura conta (saco de 2500 g numa fatura em kg → 2,5 kg).
    const f = unitFactor(pres.contentUnit, unit);
    const content = f !== null ? pres.contentQuantity * f : pres.contentQuantity;
    const contentUnit = f !== null ? unit : pres.contentUnit;
    return `${qty(packages)} ${plural(pres.packageUnit, packages)} × ${qty(content)} ${contentUnit} = ${qty(packages * content)} ${contentUnit}`;
  }
  const pack = packFromDescription(l.description);
  if (pack && !invoiceQuantityUnit(l.purchaseUnit, l.description)) {
    const label = pack.packageUnit ? ` ${plural(pack.packageUnit, q)}` : "";
    return `${qty(q)}${label} × ${qty(pack.quantity)} ${pack.unit} = ${qty(q * pack.quantity)} ${pack.unit}`;
  }
  return `${qty(q)} ${unit} × ${eurDoc(l.unitCostWithoutVat)} €`;
}
