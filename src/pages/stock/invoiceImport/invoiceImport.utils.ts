/**
 * Total da linha com IVA (P. unit. s/ IVA). Na revisão de importação, `quantity`
 * deve ser a **qtd. fatura** — o total não segue a qtd. de stock.
 */
export function recomputeLineTotal(
  quantity: number,
  unitPrice: number,
  vatRatePct: number | null,
): number {
  const v = vatRatePct ?? 0;
  return Math.round(quantity * unitPrice * (1 + v / 100) * 100) / 100;
}

/** Valor antes do desconto, assumindo `post` já com desconto e `discountPct` em % (10 = 10%). */
export function preDiscountFromPost(
  post: number,
  discountPct: number | null,
): number | null {
  if (
    discountPct == null ||
    !Number.isFinite(discountPct) ||
    discountPct <= 0 ||
    discountPct >= 100 ||
    !Number.isFinite(post)
  ) {
    return null;
  }
  return post / (1 - discountPct / 100);
}

const PRICE_EPS = 1e-5;

export function invoiceLinePricesWereCorrected(line: {
  unit_price: number;
  vat_rate_pct: number | null;
  original_unit_price: number;
  original_vat_rate_pct: number | null;
}): boolean {
  if (Math.abs(line.unit_price - line.original_unit_price) > PRICE_EPS) {
    return true;
  }
  const a = line.original_vat_rate_pct;
  const b = line.vat_rate_pct;
  if (a === null && b === null) return false;
  if (a === null || b === null) return true;
  return Math.abs(a - b) > PRICE_EPS;
}

/**
 * P. unitário c/ IVA para o body de confirm — o backend espera bruto quando o utilizador
 * corrigiu o preço extraído.
 */
export function unitNetToGrossForConfirm(
  unitNet: number,
  vatRatePct: number | null,
): number {
  const v = vatRatePct ?? 0;
  return Math.round(unitNet * (1 + v / 100) * 1e6) / 1e6;
}

/** `YYYY-MM-DD` para o confirm: usa data da fatura se já estiver nesse formato (ou prefixo); senão hoje (UTC local do browser). */
export function defaultMovementDateForConfirm(
  invoiceDate: string | null | undefined,
): string {
  const raw = invoiceDate?.trim();
  if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  if (raw && /^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  return new Date().toISOString().slice(0, 10);
}
