/** Estados do ciclo de vida da importação (alinhado com o backend). */
export type InvoiceImportStatus =
  | "processing"
  | "ready_for_review"
  | "confirmed"
  | "failed"
  | "cancelled";

/** Estado do match por linha devolvido pelo parser. */
export type InvoiceLineMatchStatus = "matched" | "needs_review" | "ignored";

export type InvoiceImportHeader = {
  supplier_name: string | null;
  invoice_number: string | null;
  invoice_date: string | null;
  /** ISO 4217, ex. EUR */
  currency: string;
  subtotal: number | null;
  tax_total: number | null;
  total: number | null;
};

/**
 * Modelo interno do UI. O normalizador mapeia a API, ex.:
 * `unit_price_net` → `unit_price`, `line_total_gross` → `line_total`,
 * `vat_rate` decimal (0.23) → `vat_rate_pct` (23), `line_status` → `match_status`,
 * `stock_item_id` → `suggested_stock_item_id`.
 * Fatura vs stock: se a API enviar `invoice_quantity` / `invoice_unit` e `stock_quantity` /
 * `stock_unit`, usam-se; caso contrário `quantity`/`unit` da API preenchem ambos os pares.
 * `discount_pct`: % de desconto na linha (10 = 10%); preços e totais já vêm **após** desconto.
 */
export type InvoiceImportLine = {
  id: string;
  description: string;
  /** Quantidade na fatura (documento). */
  invoice_quantity: number;
  /** Unidade na fatura (ex. PC, KG). */
  invoice_unit: string;
  /** Quantidade mapeada para stock (editável; vai no confirm). */
  quantity: number;
  /** Unidade de stock / mapeamento (editável no UI; não vai no confirm). */
  unit: string;
  unit_price: number;
  /** Percentagem 0–100 (ex.: 23), ou null */
  vat_rate_pct: number | null;
  /** Desconto em % na linha (ex. 10); null = sem desconto indicado. */
  discount_pct: number | null;
  line_total: number;
  suggested_stock_item_id: string | null;
  match_status: InvoiceLineMatchStatus;
  /** 0–1 quando o backend envia */
  match_confidence: number | null;
};

export type InvoiceImportDetail = {
  import_id: string;
  status: InvoiceImportStatus;
  header: InvoiceImportHeader;
  lines: InvoiceImportLine[];
  /** Mensagem amigável em falhas ou cancelamento */
  message?: string | null;
  /** Nome do ficheiro original (opcional) */
  filename?: string | null;
  /**
   * Quando true, já existe importação confirmada com a mesma chave (fornecedor + nº + data).
   * O confirm deve enviar `override_duplicate: true` para substituir.
   */
  duplicate_warning?: boolean;
  /** Import confirmada duplicada, quando `duplicate_warning` */
  duplicate_of_import_id?: string | null;
  /** Erro de parsing devolvido pela API (pode coexistir com `message`) */
  parse_error?: string | null;
};

/** Resposta do POST upload — pode trazer o detalhe completo já em `ready_for_review` ou `failed`. */
export type CreateInvoiceImportResponse = {
  import_id: string;
  status: InvoiceImportStatus;
  header?: InvoiceImportHeader;
  lines?: InvoiceImportLine[];
  message?: string | null;
  filename?: string | null;
  duplicate_warning?: boolean;
  duplicate_of_import_id?: string | null;
  parse_error?: string | null;
};

/**
 * Uma linha no pedido de confirmação.
 * `unit_price` (bruto c/ IVA) e `vat_rate_pct` só devem ser enviados se o utilizador
 * corrigiu valores extraídos; caso contrário omitir (backend usa o parse).
 */
export type ConfirmInvoiceImportLinePayload = {
  line_id: string;
  stock_item_id: string | null;
  ignored: boolean;
  /** Quantidade de stock após mapeamento / conversão (crítico para aprendizagem). */
  quantity: number;
  /** P. unitário c/ IVA — opcional, só se corrigido face ao extracto. */
  unit_price?: number;
  /** IVA em % (23, não 0.23) — opcional, só se corrigido. */
  vat_rate_pct?: number;
};

export type ConfirmInvoiceImportPayload = {
  /** Obrigatório no backend: `true` para substituir import confirmada duplicada. */
  override_duplicate: boolean;
  lines: ConfirmInvoiceImportLinePayload[];
  /**
   * Data dos movimentos de stock gerados (`YYYY-MM-DD` ou ISO 8601).
   * Se omitido, o servidor usa a data de confirmação (hoje).
   */
  movement_date?: string | null;
};

export type ConfirmInvoiceImportResponse = {
  movements_created: number;
  items_updated: number;
  message?: string | null;
};

/** Linha em revisão no cliente (cópia editável). */
export type ReviewableInvoiceLine = {
  line_id: string;
  description: string;
  invoice_quantity: number;
  invoice_unit: string;
  quantity: number;
  unit: string;
  unit_price: number;
  vat_rate_pct: number | null;
  discount_pct: number | null;
  line_total: number;
  /** Valores do GET inicial — para saber se preço/IVA foram corrigidos no confirm. */
  original_unit_price: number;
  original_vat_rate_pct: number | null;
  suggested_stock_item_id: string | null;
  match_status: InvoiceLineMatchStatus;
  match_confidence: number | null;
  stock_item_id: string | null;
  ignored: boolean;
};

export function defaultInvoiceImportHeader(): InvoiceImportHeader {
  return {
    supplier_name: null,
    invoice_number: null,
    invoice_date: null,
    currency: "EUR",
    subtotal: null,
    tax_total: null,
    total: null,
  };
}

export function toReviewableLines(lines: InvoiceImportLine[]): ReviewableInvoiceLine[] {
  return lines.map((l) => ({
    line_id: l.id,
    description: l.description,
    invoice_quantity: l.invoice_quantity,
    invoice_unit: l.invoice_unit,
    quantity: l.quantity,
    unit: l.unit,
    unit_price: l.unit_price,
    vat_rate_pct: l.vat_rate_pct,
    discount_pct: l.discount_pct ?? null,
    line_total: l.line_total,
    original_unit_price: l.unit_price,
    original_vat_rate_pct: l.vat_rate_pct,
    suggested_stock_item_id: l.suggested_stock_item_id,
    match_status: l.match_status,
    match_confidence: l.match_confidence,
    stock_item_id: l.suggested_stock_item_id,
    ignored: l.match_status === "ignored",
  }));
}
