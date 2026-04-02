import { useState } from "react";
import { formatInvoiceDate, formatMoney } from "../../../../lib/format";
import type { InvoiceImportHeader } from "../invoiceImport.types";
import type { UpdateInvoiceImportPayload } from "../invoiceImport.types";

type Props = {
  header: InvoiceImportHeader;
  onSave?: (patch: UpdateInvoiceImportPayload) => Promise<void>;
};

type FormState = {
  supplier_name: string;
  invoice_number: string;
  invoice_date: string;
  currency: string;
  subtotal: string;
  tax_total: string;
  total: string;
};

function headerToForm(h: InvoiceImportHeader): FormState {
  return {
    supplier_name: h.supplier_name ?? "",
    invoice_number: h.invoice_number ?? "",
    invoice_date: h.invoice_date ?? "",
    currency: h.currency || "EUR",
    subtotal: h.subtotal != null ? String(h.subtotal) : "",
    tax_total: h.tax_total != null ? String(h.tax_total) : "",
    total: h.total != null ? String(h.total) : "",
  };
}

function buildPatch(
  original: InvoiceImportHeader,
  form: FormState,
): UpdateInvoiceImportPayload {
  const patch: UpdateInvoiceImportPayload = {};

  const strOrNull = (s: string) => s.trim() || null;
  const numOrNull = (s: string) => {
    const n = parseFloat(s);
    return isNaN(n) ? null : n;
  };

  if ((original.supplier_name ?? "") !== form.supplier_name.trim()) {
    patch.supplier_name = strOrNull(form.supplier_name);
  }
  if ((original.invoice_number ?? "") !== form.invoice_number.trim()) {
    patch.invoice_number = strOrNull(form.invoice_number);
  }
  if ((original.invoice_date ?? "") !== form.invoice_date) {
    patch.invoice_date = form.invoice_date.trim() || null;
  }
  if ((original.currency || "EUR") !== form.currency.trim()) {
    patch.currency = form.currency.trim() || "EUR";
  }
  const origSubtotal = original.subtotal != null ? String(original.subtotal) : "";
  if (origSubtotal !== form.subtotal) {
    patch.subtotal = numOrNull(form.subtotal);
  }
  const origTaxTotal = original.tax_total != null ? String(original.tax_total) : "";
  if (origTaxTotal !== form.tax_total) {
    patch.tax_total = numOrNull(form.tax_total);
  }
  const origTotal = original.total != null ? String(original.total) : "";
  if (origTotal !== form.total) {
    patch.total = numOrNull(form.total);
  }

  return patch;
}

export function InvoiceHeaderSummary({ header, onSave }: Props) {
  const ccy = header.currency || "EUR";
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<FormState>(() => headerToForm(header));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleEdit = () => {
    setForm(headerToForm(header));
    setSaveError(null);
    setEditing(true);
  };

  const handleCancel = () => {
    setEditing(false);
    setSaveError(null);
  };

  const handleSave = async () => {
    if (!onSave) return;
    const patch = buildPatch(header, form);
    if (Object.keys(patch).length === 0) {
      setEditing(false);
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      await onSave(patch);
      setEditing(false);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Erro ao guardar.");
    } finally {
      setSaving(false);
    }
  };

  const set = (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  if (editing) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-4">
        <h4 className="text-sm font-semibold text-slate-800">Cabeçalho da fatura</h4>
        <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="text-xs text-slate-500">Fornecedor</label>
            <input
              type="text"
              value={form.supplier_name}
              onChange={set("supplier_name")}
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-400"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500">N.º fatura</label>
            <input
              type="text"
              value={form.invoice_number}
              onChange={set("invoice_number")}
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-400"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500">Data</label>
            <input
              type="date"
              value={form.invoice_date}
              onChange={set("invoice_date")}
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-400"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500">Moeda</label>
            <input
              type="text"
              maxLength={3}
              value={form.currency}
              onChange={set("currency")}
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-400"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500">Subtotal</label>
            <input
              type="number"
              step="0.01"
              value={form.subtotal}
              onChange={set("subtotal")}
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-400"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500">Impostos</label>
            <input
              type="number"
              step="0.01"
              value={form.tax_total}
              onChange={set("tax_total")}
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-400"
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <label className="text-xs text-slate-500">Total</label>
            <input
              type="number"
              step="0.01"
              value={form.total}
              onChange={set("total")}
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-400"
            />
          </div>
        </div>
        {saveError && (
          <p className="mt-2 text-xs text-red-700">{saveError}</p>
        )}
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {saving ? "A guardar…" : "Guardar"}
          </button>
          <button
            type="button"
            onClick={handleCancel}
            disabled={saving}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-slate-800">Cabeçalho da fatura</h4>
        {onSave && (
          <button
            type="button"
            onClick={handleEdit}
            className="text-xs text-slate-500 underline hover:text-slate-700"
          >
            Editar
          </button>
        )}
      </div>
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
