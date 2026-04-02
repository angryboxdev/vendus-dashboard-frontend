import type {
  ConfirmInvoiceImportPayload,
  ConfirmInvoiceImportResponse,
  InvoiceImportDetail,
  InvoiceImportHeader,
  InvoiceImportLine,
  UpdateInvoiceImportPayload,
} from "./invoiceImport.types";
import { defaultInvoiceImportHeader } from "./invoiceImport.types";

const STORAGE_PREFIX = "vendus_invoice_import_mock:";

function key(id: string) {
  return `${STORAGE_PREFIX}${id}`;
}

type MockRecord = {
  status: InvoiceImportDetail["status"];
  filename: string;
  readyAt: number;
  failParsing?: boolean;
  duplicateWarning?: boolean;
  header?: InvoiceImportDetail["header"];
  lines?: InvoiceImportLine[];
  failMessage?: string;
  confirmResult?: ConfirmInvoiceImportResponse;
};

function read(id: string): MockRecord | null {
  try {
    const raw = sessionStorage.getItem(key(id));
    if (!raw) return null;
    return JSON.parse(raw) as MockRecord;
  } catch {
    return null;
  }
}

function write(id: string, rec: MockRecord) {
  sessionStorage.setItem(key(id), JSON.stringify(rec));
}

function buildMockLines(): InvoiceImportLine[] {
  return [
    {
      id: "mock-line-1",
      description: "Farinha T55 / saco 25 kg",
      invoice_quantity: 1,
      invoice_unit: "PC",
      raw_invoice_quantity: 25,
      quantity: 4,
      unit: "un",
      unit_price: 5.58,
      vat_rate_pct: 23,
      discount_pct: 10,
      line_total: 6.86,
      suggested_stock_item_id: null,
      match_status: "needs_review",
      match_confidence: 0.42,
    },
    {
      id: "mock-line-2",
      description: "Azeite virgem extra 5L",
      invoice_quantity: 6,
      invoice_unit: "un",
      quantity: 6,
      unit: "un",
      unit_price: 28.0,
      vat_rate_pct: 13,
      discount_pct: null,
      line_total: 189.84,
      suggested_stock_item_id: null,
      match_status: "matched",
      match_confidence: 0.91,
    },
    {
      id: "mock-line-3",
      description: "Taxa de embalagem / serviço",
      invoice_quantity: 1,
      invoice_unit: "un",
      quantity: 1,
      unit: "un",
      unit_price: 2.5,
      vat_rate_pct: 23,
      discount_pct: null,
      line_total: 3.08,
      suggested_stock_item_id: null,
      match_status: "ignored",
      match_confidence: null,
    },
    {
      id: "mock-line-4",
      description: "Leite UHT 1L",
      invoice_quantity: 24,
      invoice_unit: "un",
      quantity: 24,
      unit: "un",
      unit_price: 0.89,
      vat_rate_pct: 6,
      discount_pct: null,
      line_total: 22.65,
      suggested_stock_item_id: null,
      match_status: "needs_review",
      match_confidence: 0.55,
    },
  ];
}

function mockHeader(): InvoiceImportHeader {
  const lines = buildMockLines().filter((l) => l.match_status !== "ignored");
  const sub = lines.reduce(
    (s, l) => s + l.line_total / (1 + (l.vat_rate_pct ?? 0) / 100),
    0,
  );
  const sumLines = lines.reduce((s, l) => s + l.line_total, 0);
  return {
    supplier_name: "Fornecedor Demo Lda.",
    invoice_number: "FT 2025/8842",
    invoice_date: "2025-03-15",
    currency: "EUR",
    subtotal: Math.round(sub * 100) / 100,
    tax_total: Math.round((sumLines - sub) * 100) / 100,
    /** Ligeiramente diferente da soma das linhas para demonstrar aviso de validação */
    total: Math.round((sumLines + 2.5) * 100) / 100,
  };
}

export function mockCreateInvoiceImport(file: File): {
  import_id: string;
  status: "processing";
} {
  const import_id = crypto.randomUUID();
  const failParsing = file.name.toLowerCase().includes("fail");
  const duplicateWarning = file.name.toLowerCase().includes("duplicate");
  const rec: MockRecord = {
    status: "processing",
    filename: file.name,
    readyAt: Date.now() + 1800,
    failParsing,
    duplicateWarning,
  };
  write(import_id, rec);
  return { import_id, status: "processing" };
}

export function mockGetInvoiceImport(id: string): InvoiceImportDetail {
  const rec = read(id);
  if (!rec) {
    return {
      import_id: id,
      status: "failed",
      header: defaultInvoiceImportHeader(),
      lines: [],
      message: "Importação não encontrada (expirou ou ID inválido).",
    };
  }

  if (rec.status === "confirmed" && rec.confirmResult) {
    return {
      import_id: id,
      status: "confirmed",
      header: rec.header ?? mockHeader(),
      lines: rec.lines ?? [],
      filename: rec.filename,
      message: rec.confirmResult.message ?? "Importação concluída.",
    };
  }

  if (rec.status === "failed") {
    return {
      import_id: id,
      status: "failed",
      header: defaultInvoiceImportHeader(),
      lines: [],
      filename: rec.filename,
      message: rec.failMessage ?? "O processamento falhou.",
    };
  }

  if (rec.status === "cancelled") {
    return {
      import_id: id,
      status: "cancelled",
      header: defaultInvoiceImportHeader(),
      lines: [],
      message: "Importação cancelada.",
    };
  }

  if (rec.status === "processing" && Date.now() < rec.readyAt) {
    return {
      import_id: id,
      status: "processing",
      header: defaultInvoiceImportHeader(),
      lines: [],
      filename: rec.filename,
    };
  }

  if (rec.status === "processing" && rec.failParsing) {
    const failed: MockRecord = {
      ...rec,
      status: "failed",
      failMessage:
        "Não foi possível extrair dados do ficheiro (simulação: nome contém «fail»).",
    };
    write(id, failed);
    return {
      import_id: id,
      status: "failed",
      header: defaultInvoiceImportHeader(),
      lines: [],
      filename: rec.filename,
      message: failed.failMessage,
    };
  }

  if (rec.status === "processing") {
    const header = mockHeader();
    const lines = buildMockLines();
    const ready: MockRecord = {
      ...rec,
      status: "ready_for_review",
      header,
      lines,
    };
    write(id, ready);
    return {
      import_id: id,
      status: "ready_for_review",
      header,
      lines,
      filename: rec.filename,
      duplicate_warning: Boolean(rec.duplicateWarning),
    };
  }

  return {
    import_id: id,
    status: "ready_for_review",
    header: rec.header ?? mockHeader(),
    lines: rec.lines ?? buildMockLines(),
    filename: rec.filename,
    duplicate_warning: Boolean(rec.duplicateWarning),
  };
}

export function mockUpdateInvoiceImport(
  id: string,
  payload: UpdateInvoiceImportPayload,
): InvoiceImportDetail {
  const rec = read(id);
  if (!rec || rec.status !== "ready_for_review") {
    throw new Error("A fatura não está em revisão ou não foi encontrada.");
  }
  const currentHeader = rec.header ?? mockHeader();
  const updatedHeader: InvoiceImportHeader = {
    ...currentHeader,
    ...("supplier_name" in payload ? { supplier_name: payload.supplier_name ?? null } : {}),
    ...("invoice_number" in payload ? { invoice_number: payload.invoice_number ?? null } : {}),
    ...("invoice_date" in payload ? { invoice_date: payload.invoice_date ?? null } : {}),
    ...("currency" in payload && payload.currency != null ? { currency: payload.currency } : {}),
    ...("subtotal" in payload ? { subtotal: payload.subtotal ?? null } : {}),
    ...("tax_total" in payload ? { tax_total: payload.tax_total ?? null } : {}),
    ...("total" in payload ? { total: payload.total ?? null } : {}),
  };
  const keyChanged =
    "supplier_name" in payload ||
    "invoice_number" in payload ||
    "invoice_date" in payload;
  const duplicate_warning = keyChanged ? false : Boolean(rec.duplicateWarning);
  const updated: MockRecord = { ...rec, header: updatedHeader, duplicateWarning: duplicate_warning };
  write(id, updated);
  return {
    import_id: id,
    status: "ready_for_review",
    header: updatedHeader,
    lines: rec.lines ?? buildMockLines(),
    filename: rec.filename,
    duplicate_warning,
  };
}

export function mockConfirmInvoiceImport(
  id: string,
  _payload: ConfirmInvoiceImportPayload,
): ConfirmInvoiceImportResponse {
  const rec = read(id);
  if (!rec || rec.status !== "ready_for_review") {
    throw new Error("Estado inválido para confirmar.");
  }
  if (rec.duplicateWarning && !_payload.override_duplicate) {
    throw new Error(
      "Já existe uma importação confirmada para esta fatura. Assinale a substituição no passo de confirmação.",
    );
  }
  const active = _payload.lines.filter((l) => !l.ignored).length;
  const result: ConfirmInvoiceImportResponse = {
    movements_created: active,
    items_updated: active,
    message: `${active} movimento(s) registado(s).`,
  };
  const done: MockRecord = {
    ...rec,
    status: "confirmed",
    confirmResult: result,
  };
  write(id, done);
  return result;
}

