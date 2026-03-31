import type { InvoiceImportHeader } from "./invoiceImport.types";
import type { ReviewableInvoiceLine } from "./invoiceImport.types";

export type InvoiceImportValidation = {
  errors: string[];
  warnings: string[];
  canConfirm: boolean;
};

const TOTAL_EPS = 0.02;

export function validateInvoiceImportForConfirm(
  header: InvoiceImportHeader,
  lines: ReviewableInvoiceLine[],
): InvoiceImportValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const line of lines) {
    if (line.ignored) continue;
    if (!line.stock_item_id?.trim()) {
      errors.push(
        `Linha sem item de stock: «${truncate(line.description, 48)}»`,
      );
    }
    if (line.quantity <= 0) {
      errors.push(
        `Quantidade de stock inválida (≤0) na linha «${truncate(line.description, 40)}»`,
      );
    }
  }

  const activeLines = lines.filter((l) => !l.ignored);
  if (activeLines.length === 0) {
    errors.push("Nenhuma linha ativa para aplicar. Marque pelo menos uma linha ou cancele.");
  }

  if (!header.invoice_date?.trim()) {
    warnings.push("Data da fatura em falta ou não detetada.");
  }
  if (!header.invoice_number?.trim()) {
    warnings.push("Número da fatura em falta ou não detetado.");
  }
  if (!header.supplier_name?.trim()) {
    warnings.push("Fornecedor em falta ou não detetado.");
  }

  const sumLines = activeLines.reduce((s, l) => s + (l.line_total || 0), 0);
  if (
    header.total != null &&
    activeLines.length > 0 &&
    Math.abs(sumLines - header.total) > TOTAL_EPS
  ) {
    warnings.push(
      `Soma das linhas (${sumLines.toFixed(2)}) difere do total da fatura (${header.total.toFixed(2)}).`,
    );
  }

  return {
    errors,
    warnings,
    canConfirm: errors.length === 0,
  };
}

function truncate(s: string, max: number) {
  const t = (s || "").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}
