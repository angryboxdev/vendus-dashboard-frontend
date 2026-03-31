import { formatInvoiceDate, formatMoney } from "../../../../lib/format";
import type { InvoiceImportHeader } from "../invoiceImport.types";

export function InvoiceHeaderSummary({ header }: { header: InvoiceImportHeader }) {
  const ccy = header.currency || "EUR";

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-4">
      <h4 className="text-sm font-semibold text-slate-800">Cabeçalho da fatura</h4>
      <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <dt className="text-xs text-slate-500">Fornecedor</dt>
          <dd className="font-medium text-slate-800">
            {header.supplier_name?.trim() || (
              <span className="text-amber-700">Em falta</span>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">N.º fatura</dt>
          <dd className="font-medium text-slate-800">
            {header.invoice_number?.trim() || (
              <span className="text-amber-700">Em falta</span>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Data</dt>
          <dd className="font-medium text-slate-800">
            {header.invoice_date ? formatInvoiceDate(header.invoice_date) : (
              <span className="text-amber-700">Em falta</span>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Moeda</dt>
          <dd className="font-medium text-slate-800">{ccy}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Subtotal</dt>
          <dd className="tabular-nums text-slate-800">
            {header.subtotal != null ? formatMoney(header.subtotal, ccy) : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Impostos</dt>
          <dd className="tabular-nums text-slate-800">
            {header.tax_total != null ? formatMoney(header.tax_total, ccy) : "—"}
          </dd>
        </div>
        <div className="sm:col-span-2 lg:col-span-3">
          <dt className="text-xs text-slate-500">Total</dt>
          <dd className="text-base font-semibold tabular-nums text-slate-900">
            {header.total != null ? formatMoney(header.total, ccy) : "—"}
          </dd>
        </div>
      </dl>
    </div>
  );
}
