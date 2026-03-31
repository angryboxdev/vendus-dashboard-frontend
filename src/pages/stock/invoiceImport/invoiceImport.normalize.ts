import type {
  InvoiceImportDetail,
  InvoiceImportHeader,
  InvoiceImportLine,
  InvoiceImportStatus,
  InvoiceLineMatchStatus,
} from "./invoiceImport.types";
import { defaultInvoiceImportHeader } from "./invoiceImport.types";

const STATUSES: InvoiceImportStatus[] = [
  "processing",
  "ready_for_review",
  "confirmed",
  "failed",
  "cancelled",
];

function unwrapPayload(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  const data = o.data;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    return data as Record<string, unknown>;
  }
  return o;
}

function pickStr(...vals: unknown[]): string | undefined {
  for (const v of vals) {
    if (typeof v === "string" && v.trim() !== "") return v;
  }
  return undefined;
}

function pickNullableStr(...vals: unknown[]): string | null {
  const s = pickStr(...vals);
  return s ?? null;
}

function pickNum(...vals: unknown[]): number | null {
  for (const v of vals) {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim() !== "") {
      const n = Number(v.replace(",", "."));
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

function normalizeStatus(raw: unknown): InvoiceImportStatus {
  if (typeof raw !== "string") return "processing";
  const s = raw
    .trim()
    .toLowerCase()
    .replace(/-/g, "_")
    .replace(/\s+/g, "_");
  return (STATUSES.includes(s as InvoiceImportStatus)
    ? s
    : "processing") as InvoiceImportStatus;
}

function normalizeMatchStatus(...raws: unknown[]): InvoiceLineMatchStatus {
  for (const raw of raws) {
    if (typeof raw !== "string") continue;
    const s = raw.trim().toLowerCase().replace(/-/g, "_");
    if (s === "matched" || s === "needs_review" || s === "ignored") return s;
  }
  return "needs_review";
}

/** Percentagem de desconto na linha (10 = 10%); null se inexistente ou inválido. */
function normalizeDiscountPct(x: Record<string, unknown>): number | null {
  const n = pickNum(
    x.discount_pct,
    x.discount_percent,
    x.line_discount_pct,
  );
  if (n == null || !Number.isFinite(n) || n <= 0 || n >= 100) return null;
  return n;
}

/**
 * UI usa percentagem (23 para 23%). API pode enviar decimal (0.23) ou já em percentagem.
 */
function normalizeVatRateToPct(x: Record<string, unknown>): number | null {
  const raw = pickNum(
    x.vat_rate_pct,
    x.vat_percent,
    x.vat_rate,
    x.vat,
  );
  if (raw == null || !Number.isFinite(raw)) return null;
  if (raw === 0) return 0;
  if (raw > 1 && raw <= 100) return raw;
  if (raw > 0 && raw <= 1) return Math.round(raw * 10000) / 100;
  return raw;
}

function normalizeHeader(raw: unknown): InvoiceImportHeader {
  if (!raw || typeof raw !== "object") return defaultInvoiceImportHeader();
  const h = raw as Record<string, unknown>;
  return {
    supplier_name: pickNullableStr(
      h.supplier_name,
      h.supplier,
      h.vendor_name,
      h.seller_name,
    ),
    invoice_number: pickNullableStr(
      h.invoice_number,
      h.number,
      h.invoice_no,
      h.document_number,
      h.invoice_num,
    ),
    invoice_date: pickNullableStr(
      h.invoice_date,
      h.date,
      h.document_date,
      h.issue_date,
    ),
    currency: pickStr(h.currency, h.currency_code, h.curr) || "EUR",
    subtotal: pickNum(h.subtotal, h.sub_total, h.net_total, h.amount_net),
    tax_total: pickNum(
      h.tax_total,
      h.taxes_total,
      h.vat_total,
      h.tax_amount,
      h.total_tax,
    ),
    total: pickNum(h.total, h.grand_total, h.amount_total, h.gross_total),
  };
}

/**
 * Cabeçalho pode vir no objeto raiz (campos flat) ou em `header` / `invoice` aninhados.
 * Se existir aninhado, faz merge com o raiz (chaves do objeto aninhado prevalecem).
 */
function resolveHeaderSource(root: Record<string, unknown>): unknown {
  const nested =
    root.header ?? root.invoice_header ?? root.invoice ?? root.document;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    return { ...root, ...(nested as Record<string, unknown>) };
  }
  return root;
}

function normalizeLine(raw: unknown, index: number): InvoiceImportLine {
  if (!raw || typeof raw !== "object") {
    return {
      id: `line-${index}`,
      description: "",
      invoice_quantity: 0,
      invoice_unit: "un",
      quantity: 0,
      unit: "un",
      unit_price: 0,
      vat_rate_pct: null,
      discount_pct: null,
      line_total: 0,
      suggested_stock_item_id: null,
      match_status: "needs_review",
      match_confidence: null,
    };
  }
  const x = raw as Record<string, unknown>;
  const id =
    pickStr(x.id, x.line_id, x.stock_line_id) || `line-${index}`;
  const rawQ = pickNum(x.quantity, x.qty) ?? 0;
  const rawU = pickStr(x.unit, x.uom, x.unit_code) || "un";
  const invQ =
    pickNum(x.invoice_quantity, x.invoice_qty, x.qty_invoice) ?? rawQ;
  const invU =
    pickStr(x.invoice_unit, x.unit_invoice, x.invoice_uom) || rawU;
  const stockQ =
    pickNum(x.stock_quantity, x.qty_stock, x.quantity_stock) ?? rawQ;
  const stockU =
    pickStr(x.stock_unit, x.unit_stock, x.unit_stock_code) || rawU;
  const vatPct = normalizeVatRateToPct(x);
  const unitPrice =
    pickNum(
      x.unit_price_net,
      x.unit_price,
      x.price,
      x.unit_cost,
    ) ?? pickNum(x.unit_price_gross) ?? 0;
  const lineTotal =
    pickNum(
      x.line_total_gross,
      x.line_total,
      x.total,
      x.amount,
      x.line_total_net,
    ) ?? invQ * unitPrice * (1 + (vatPct ?? 0) / 100);
  return {
    id,
    description: pickStr(x.description, x.desc, x.name, x.title) || "",
    invoice_quantity: invQ,
    invoice_unit: invU,
    quantity: stockQ,
    unit: stockU,
    unit_price: unitPrice,
    vat_rate_pct: vatPct,
    discount_pct: normalizeDiscountPct(x),
    line_total: lineTotal,
    suggested_stock_item_id: pickNullableStr(
      x.suggested_stock_item_id,
      x.stock_item_id,
      x.matched_stock_item_id,
    ),
    match_status: normalizeMatchStatus(x.match_status, x.line_status),
    match_confidence: normalizeConfidence(
      pickNum(x.match_confidence, x.confidence),
    ),
  };
}

/** Backend pode enviar 0–1 ou 0–100. */
function normalizeConfidence(v: number | null): number | null {
  if (v == null) return null;
  if (v > 1 && v <= 100) return v / 100;
  return v;
}

function normalizeLines(raw: unknown): InvoiceImportLine[] {
  if (!Array.isArray(raw)) return [];
  const decorated = raw.map((row, i) => {
    const sortKey =
      row && typeof row === "object"
        ? (pickNum((row as Record<string, unknown>).line_index) ?? i)
        : i;
    return { row, sortKey };
  });
  decorated.sort((a, b) => a.sortKey - b.sortKey);
  return decorated.map(({ row }, i) => normalizeLine(row, i));
}

/**
 * Converte a resposta crua do POST/GET para o formato esperado pelo UI.
 * Aceita aliases comuns (`id` vs `import_id`, `line_id` vs `id`, etc.).
 */
function mergeNestedImport(o: Record<string, unknown>): Record<string, unknown> {
  for (const key of [
    "import",
    "supplier_invoice_import",
    "invoice_import",
    "record",
  ]) {
    const inner = o[key];
    if (inner && typeof inner === "object" && !Array.isArray(inner)) {
      return { ...o, ...(inner as Record<string, unknown>) };
    }
  }
  return o;
}

export function normalizeInvoiceImportDetail(
  raw: unknown,
  fallbackImportId?: string,
): InvoiceImportDetail | null {
  const o = mergeNestedImport(unwrapPayload(raw));
  const import_id =
    pickStr(o.import_id, o.id, o.uuid) ?? fallbackImportId ?? "";
  if (!import_id) return null;

  const status = normalizeStatus(o.status);
  const header = normalizeHeader(resolveHeaderSource(o));
  const lines = normalizeLines(
    o.lines ?? o.invoice_lines ?? o.items ?? o.line_items,
  );

  return {
    import_id,
    status,
    header,
    lines,
    message: pickNullableStr(
      o.message,
      o.error,
      o.detail,
      o.parse_error,
    ),
    filename: pickNullableStr(
      o.filename,
      o.file_name,
      o.original_filename,
    ),
    duplicate_warning: Boolean(o.duplicate_warning),
    duplicate_of_import_id: pickNullableStr(o.duplicate_of_import_id),
    parse_error: pickNullableStr(o.parse_error),
  };
}
