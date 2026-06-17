import { useState, useMemo, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useInvoicesModule } from "../../invoices.module.tsx";
import {
  type InvoiceDTO,
  type InvoiceLineDTO,
  type InvoiceStatus,
  type InvoiceLineType,
  type CreateInvoicePayload,
  INVOICE_STATUS_LABELS,
  INVOICE_LINE_TYPE_LABELS,
} from "../../domain/entities/invoice.ts";
import { useFinancialBaseModule } from "../../../financial-base/financial-base.module.tsx";
import { usePayableEntriesModule } from "../../../payable-entries/payable-entries.module.tsx";
import {
  type PayableEntryDTO,
  PAYABLE_STATUS_LABELS,
} from "../../../payable-entries/domain/entities/payable-entry.ts";
import { PageFooter } from "../../../../components/PageFooter.tsx";

// ── helpers ────────────────────────────────────────────────────────────────────

function fromCents(n: number): string {
  return (n / 100).toLocaleString("pt-PT", {
    style: "currency",
    currency: "EUR",
  });
}

function formatDate(s: string | null): string {
  if (!s) return "—";
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y}`;
}

// ── StatusBadge ────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<InvoiceStatus, string> = {
  pending: "bg-amber-50 text-amber-700",
  paid: "bg-emerald-50 text-emerald-700",
  overdue: "bg-red-50 text-red-700",
  partial: "bg-blue-50 text-blue-700",
  cancelled: "bg-stone-100 text-stone-500",
  review: "bg-purple-50 text-purple-700",
};

const STATUS_DOT: Record<InvoiceStatus, string> = {
  pending: "bg-amber-500",
  paid: "bg-emerald-500",
  overdue: "bg-red-500",
  partial: "bg-blue-500",
  cancelled: "bg-stone-400",
  review: "bg-purple-500",
};

function StatusBadge({ status }: { status: InvoiceStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[status]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[status]}`} />
      {INVOICE_STATUS_LABELS[status]}
    </span>
  );
}

// ── KpiCard ────────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  accentClass = "text-stone-800",
}: {
  label: string;
  value: string | number;
  sub?: string;
  accentClass?: string;
}) {
  return (
    <div className="rounded-xl border border-[#F5C992]/40 bg-white px-5 py-4 shadow-sm">
      <p className="text-xs font-medium text-stone-500">{label}</p>
      <p className={`mt-1 text-xl font-bold ${accentClass}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-stone-400">{sub}</p>}
    </div>
  );
}

// ── Line Classify Panel ────────────────────────────────────────────────────────

interface ClassifyPanelProps {
  line: InvoiceLineDTO;
  invoiceId: string;
  costCenters: { id: string; code: string; name: string }[];
  onDone: (updated: InvoiceLineDTO) => void;
}

function ClassifyPanel({
  line,
  invoiceId,
  costCenters,
  onDone,
}: ClassifyPanelProps) {
  const { api } = useInvoicesModule();
  const [type, setType] = useState<InvoiceLineType>(line.type);
  const [ccId, setCcId] = useState(line.costCenterId ?? "");
  const [category, setCategory] = useState(line.category ?? "");
  const [saveRule, setSaveRule] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const updated = await api.classifyLine(invoiceId, line.id, {
        classify: {
          type,
          costCenterId: ccId || null,
          category: category || null,
        },
        saveAsRule: saveRule,
      });
      onDone(updated);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-[#F5C992]/40 bg-[#FDF8F5] p-3 text-sm">
      <p className="font-medium text-stone-700 truncate">{line.description}</p>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-stone-500">
            Tipo
          </label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as InvoiceLineType)}
            className="w-full rounded-md border border-stone-300 bg-white px-2 py-1.5 text-xs focus:outline-none focus:border-[#ED5C32]"
          >
            {(
              Object.entries(INVOICE_LINE_TYPE_LABELS) as [
                InvoiceLineType,
                string,
              ][]
            ).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-stone-500">
            Centro de Custo
          </label>
          <select
            value={ccId}
            onChange={(e) => setCcId(e.target.value)}
            className="w-full rounded-md border border-stone-300 bg-white px-2 py-1.5 text-xs focus:outline-none focus:border-[#ED5C32]"
          >
            <option value="">— nenhum —</option>
            {costCenters.map((cc) => (
              <option key={cc.id} value={cc.id}>
                {cc.code} — {cc.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-stone-500">
          Categoria
        </label>
        <input
          type="text"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="ex: Ingredientes"
          className="w-full rounded-md border border-stone-300 bg-white px-2 py-1.5 text-xs focus:outline-none focus:border-[#ED5C32]"
        />
      </div>
      <label className="flex items-center gap-2 text-xs text-stone-600">
        <input
          type="checkbox"
          checked={saveRule}
          onChange={(e) => setSaveRule(e.target.checked)}
          className="rounded"
        />
        Guardar como regra para este fornecedor
      </label>
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full rounded-md bg-gradient-to-r from-[#ED5C32] to-[#EF8935] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        {saving ? "A guardar…" : "Classificar"}
      </button>
    </div>
  );
}

// ── Invoice Detail Drawer ──────────────────────────────────────────────────────

interface DetailDrawerProps {
  invoice: InvoiceDTO | null;
  costCenters: { id: string; code: string; name: string }[];
  linkedPayable?: PayableEntryDTO | null;
  onClose: () => void;
  onMarkPaid: (id: string) => void;
  markingPaid: boolean;
}

function InvoiceDetailDrawer({
  invoice,
  costCenters,
  linkedPayable,
  onClose,
  onMarkPaid,
  markingPaid,
}: DetailDrawerProps) {
  const { api } = useInvoicesModule();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"details" | "lines">("details");
  const [lines, setLines] = useState<InvoiceLineDTO[]>([]);
  const [loadingLines, setLoadingLines] = useState(false);

  // Reload lines from API when switching to lines tab
  async function loadLines(inv: InvoiceDTO) {
    if (lines.length > 0) return;
    setLoadingLines(true);
    try {
      const full = await api.getInvoice(inv.id);
      setLines(full.lines ?? []);
    } finally {
      setLoadingLines(false);
    }
  }

  function handleTabChange(t: "details" | "lines") {
    setTab(t);
    if (t === "lines" && invoice) void loadLines(invoice);
  }

  function handleLineUpdated(updated: InvoiceLineDTO) {
    setLines((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
    void qc.invalidateQueries({ queryKey: ["invoices"] });
  }

  if (!invoice) return null;

  const ccMap = new Map(costCenters.map((cc) => [cc.id, cc]));

  return (
    <div className="fixed inset-0 z-50 flex" aria-modal="true">
      <div className="flex-1 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <aside className="flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-[#F5C992]/40 px-6 py-4">
          <div>
            <p className="text-xs font-medium text-stone-400">Fatura</p>
            <h2 className="text-lg font-bold text-stone-800">
              {invoice.supplierName}
            </h2>
            <p className="text-sm text-stone-500">
              {invoice.invoiceNumber} · {formatDate(invoice.invoiceDate)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-600"
          >
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#F5C992]/40 px-6">
          {(["details", "lines"] as const).map((t) => (
            <button
              key={t}
              onClick={() => handleTabChange(t)}
              className={`-mb-px border-b-2 px-4 py-3 text-sm font-medium ${
                tab === t
                  ? "border-[#ED5C32] text-[#ED5C32]"
                  : "border-transparent text-stone-500 hover:text-stone-700"
              }`}
            >
              {t === "details" ? "Detalhes" : "Linhas"}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {tab === "details" && (
            <div className="space-y-4">
              {/* Status + actions */}
              <div className="flex items-center justify-between">
                <StatusBadge status={invoice.status} />
                {(invoice.status === "pending" ||
                  invoice.status === "overdue") && (
                  <button
                    onClick={() => onMarkPaid(invoice.id)}
                    disabled={markingPaid}
                    className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {markingPaid ? "A registar…" : "Marcar como paga"}
                  </button>
                )}
              </div>

              {/* KPIs */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border border-stone-100 bg-stone-50 p-3 text-center">
                  <p className="text-xs text-stone-400">S/ IVA</p>
                  <p className="mt-0.5 text-sm font-semibold text-stone-800">
                    {fromCents(invoice.subtotalWithoutVat)}
                  </p>
                </div>
                <div className="rounded-lg border border-stone-100 bg-stone-50 p-3 text-center">
                  <p className="text-xs text-stone-400">IVA</p>
                  <p className="mt-0.5 text-sm font-semibold text-stone-800">
                    {fromCents(invoice.totalVat)}
                  </p>
                </div>
                <div className="rounded-lg border border-stone-100 bg-stone-50 p-3 text-center">
                  <p className="text-xs text-stone-400">Total</p>
                  <p className="mt-0.5 text-sm font-bold text-stone-800">
                    {fromCents(invoice.totalWithVat)}
                  </p>
                </div>
              </div>

              {/* Fields */}
              <dl className="divide-y divide-stone-100">
                {[
                  { label: "Fornecedor", value: invoice.supplierName },
                  { label: "Nº de fatura", value: invoice.invoiceNumber },
                  {
                    label: "Data de emissão",
                    value: formatDate(invoice.invoiceDate),
                  },
                  {
                    label: "Data de vencimento",
                    value: formatDate(invoice.dueDate),
                  },
                  {
                    label: "Data de pagamento",
                    value: formatDate(invoice.paidAt),
                  },
                  { label: "Notas", value: invoice.notes ?? "—" },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between py-2">
                    <dt className="text-xs text-stone-400">{label}</dt>
                    <dd className="text-sm font-medium text-stone-700">
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>

              {/* Linked payable entry */}
              {linkedPayable ? (
                <div className="rounded-lg border border-amber-100 bg-amber-50/60 p-3 space-y-2">
                  <p className="text-xs font-medium text-amber-700">Conta a Pagar associada</p>
                  <dl className="divide-y divide-amber-100/60">
                    {[
                      { label: "Estado", value: PAYABLE_STATUS_LABELS[linkedPayable.status] },
                      { label: "Vencimento", value: formatDate(linkedPayable.dueDate) },
                      { label: "Pago em", value: formatDate(linkedPayable.paidAt) },
                      { label: "Valor", value: (linkedPayable.amount / 100).toLocaleString("pt-PT", { style: "currency", currency: "EUR" }) },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex justify-between py-1.5">
                        <dt className="text-xs text-stone-400">{label}</dt>
                        <dd className="text-xs font-medium text-stone-700">{value}</dd>
                      </div>
                    ))}
                  </dl>
                  <button
                    onClick={() => { onClose(); navigate("/financial/payable-entries"); }}
                    className="text-xs font-medium text-amber-700 hover:text-amber-900 underline"
                  >
                    Ver contas a pagar →
                  </button>
                </div>
              ) : invoice.dueDate ? (
                <div className="rounded-lg border border-stone-100 bg-stone-50 p-3">
                  <p className="text-xs text-stone-400">Sem conta a pagar associada a esta fatura.</p>
                </div>
              ) : null}
            </div>
          )}

          {tab === "lines" && (
            <div className="space-y-3">
              {loadingLines ? (
                <p className="text-sm text-stone-400">A carregar linhas…</p>
              ) : lines.length === 0 ? (
                <p className="text-sm text-stone-400">Sem linhas registadas.</p>
              ) : (
                lines.map((line) => {
                  const cc = line.costCenterId
                    ? ccMap.get(line.costCenterId)
                    : null;
                  return (
                    <div
                      key={line.id}
                      className="space-y-2 rounded-lg border border-stone-200 bg-white p-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-stone-800">
                          {line.description}
                        </p>
                        <span className="shrink-0 rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600">
                          {INVOICE_LINE_TYPE_LABELS[line.type]}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-500">
                        <span>
                          Qtd: {line.quantity}
                          {line.unit ? ` ${line.unit}` : ""}
                        </span>
                        <span>
                          Un s/IVA: {fromCents(line.unitCostWithoutVat)}
                        </span>
                        <span>IVA: {line.vatRate}%</span>
                        <span>Total: {fromCents(line.totalWithVat)}</span>
                        {cc && <span>CC: {cc.code}</span>}
                        {line.category && <span>Cat: {line.category}</span>}
                      </div>
                      <ClassifyPanel
                        line={line}
                        invoiceId={invoice.id}
                        costCenters={costCenters}
                        onDone={handleLineUpdated}
                      />
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

// ── Create Invoice Form ────────────────────────────────────────────────────────

interface CreateFormProps {
  open: boolean;
  suppliers: { id: string; name: string }[];
  saving: boolean;
  onClose: () => void;
  onSave: (payload: CreateInvoicePayload) => void;
}

function CreateInvoiceDrawer({
  open,
  suppliers,
  saving,
  onClose,
  onSave,
}: CreateFormProps) {
  const [supplierId, setSupplierId] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [subtotal, setSubtotal] = useState("");
  const [totalVat, setTotalVat] = useState("");
  const [totalWithVat, setTotalWithVat] = useState("");
  const [notes, setNotes] = useState("");

  if (!open) return null;

  function handleSupplierChange(id: string) {
    setSupplierId(id);
    if (id) {
      const sup = suppliers.find((s) => s.id === id);
      if (sup) setSupplierName(sup.name);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: CreateInvoicePayload = {
      supplierName: supplierId
        ? (suppliers.find((s) => s.id === supplierId)?.name ?? supplierName)
        : supplierName,
      invoiceNumber,
      invoiceDate,
      subtotalWithoutVat: Math.round(parseFloat(subtotal) * 100),
      totalVat: Math.round(parseFloat(totalVat) * 100),
      totalWithVat: Math.round(parseFloat(totalWithVat) * 100),
    };
    if (supplierId) payload.supplierId = supplierId;
    if (dueDate) payload.dueDate = dueDate;
    if (notes) payload.notes = notes;
    onSave(payload);
  }

  const labelCls = "block text-xs font-medium text-stone-500 mb-1";
  const inputCls =
    "w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm focus:outline-none focus:border-[#ED5C32]";

  return (
    <div className="fixed inset-0 z-50 flex" aria-modal="true">
      <div className="flex-1 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <aside className="flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#F5C992]/40 px-6 py-4">
          <h2 className="text-lg font-bold text-stone-800">Nova Fatura</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-stone-400 hover:bg-stone-100"
          >
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>
        <form
          onSubmit={handleSubmit}
          className="flex flex-1 flex-col overflow-y-auto px-6 py-4"
        >
          <div className="flex-1 space-y-4">
            {/* Supplier */}
            <div>
              <label className={labelCls}>Fornecedor</label>
              <select
                value={supplierId}
                onChange={(e) => handleSupplierChange(e.target.value)}
                className={inputCls}
              >
                <option value="">
                  — selecionar ou preencher manualmente —
                </option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            {!supplierId && (
              <div>
                <label className={labelCls}>Nome do fornecedor (manual)</label>
                <input
                  type="text"
                  required
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  className={inputCls}
                  placeholder="ex: EDP"
                />
              </div>
            )}

            {/* Invoice number + date */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Nº de fatura</label>
                <input
                  type="text"
                  required
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  className={inputCls}
                  placeholder="EDP-2026-001"
                />
              </div>
              <div>
                <label className={labelCls}>Data de emissão</label>
                <input
                  type="date"
                  required
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>

            {/* Due date */}
            <div>
              <label className={labelCls}>Data de vencimento</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className={inputCls}
              />
            </div>

            {/* Amounts */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelCls}>Total s/ IVA (€)</label>
                <input
                  type="number"
                  required
                  step="0.01"
                  min="0"
                  value={subtotal}
                  onChange={(e) => setSubtotal(e.target.value)}
                  className={inputCls}
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className={labelCls}>IVA (€)</label>
                <input
                  type="number"
                  required
                  step="0.01"
                  min="0"
                  value={totalVat}
                  onChange={(e) => setTotalVat(e.target.value)}
                  className={inputCls}
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className={labelCls}>Total c/ IVA (€)</label>
                <input
                  type="number"
                  required
                  step="0.01"
                  min="0"
                  value={totalWithVat}
                  onChange={(e) => setTotalWithVat(e.target.value)}
                  className={inputCls}
                  placeholder="0.00"
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className={labelCls}>Notas</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className={inputCls}
                placeholder="Opcional"
              />
            </div>
          </div>

          <div className="flex gap-3 border-t border-[#F5C992]/40 pt-4 mt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-md border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-md bg-gradient-to-r from-[#ED5C32] to-[#EF8935] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "A guardar…" : "Criar fatura"}
            </button>
          </div>
        </form>
      </aside>
    </div>
  );
}

// ── Main View ──────────────────────────────────────────────────────────────────

export function InvoicesView() {
  const { api } = useInvoicesModule();
  const fbModule = useFinancialBaseModule();
  const { api: payableApi } = usePayableEntriesModule();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | "">("");
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [detail, setDetail] = useState<InvoiceDTO | null>(null);
  const [markingPaidId, setMarkingPaidId] = useState<string | null>(null);

  // Data
  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["invoices", statusFilter],
    queryFn: () =>
      api.listInvoices(statusFilter ? { status: statusFilter } : undefined),
  });

  const { data: costCenters = [] } = useQuery({
    queryKey: ["cost-centers"],
    queryFn: () => fbModule.api.listCostCenters(),
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers"],
    queryFn: () => fbModule.api.listSuppliers(),
  });

  // Payable entries cross-reference — build Map<invoiceId, PayableEntryDTO>
  const { data: allPayables = [] } = useQuery({
    queryKey: ["payable-entries"],
    queryFn: () => payableApi.listPayableEntries(),
  });

  const payableByInvoiceId = useMemo(() => {
    const map = new Map<string, PayableEntryDTO>();
    for (const p of allPayables) {
      if (p.invoiceId) map.set(p.invoiceId, p);
    }
    return map;
  }, [allPayables]);

  // Auto-open drawer when navigated with ?open=<invoiceId>
  useEffect(() => {
    const openId = searchParams.get("open");
    if (!openId || invoices.length === 0) return;
    const target = invoices.find((inv) => inv.id === openId);
    if (target) {
      setDetail(target);
      navigate("/financial/invoices", { replace: true });
    }
  }, [searchParams, invoices, navigate]);

  const createMutation = useMutation({
    mutationFn: (payload: CreateInvoicePayload) => api.createInvoice(payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["invoices"] });
      setShowCreate(false);
    },
  });

  async function handleMarkPaid(id: string) {
    setMarkingPaidId(id);
    try {
      const updated = await api.markInvoicePaid(id);
      void qc.invalidateQueries({ queryKey: ["invoices"] });
      if (detail?.id === id) setDetail(updated);
    } finally {
      setMarkingPaidId(null);
    }
  }

  // Filtered
  const filtered = useMemo(() => {
    if (!search) return invoices;
    const q = search.toLowerCase();
    return invoices.filter(
      (inv) =>
        inv.supplierName.toLowerCase().includes(q) ||
        inv.invoiceNumber.toLowerCase().includes(q),
    );
  }, [invoices, search]);

  // KPIs
  const kpis = useMemo(() => {
    const total = invoices.length;
    const totalAmountCents = invoices.reduce((s, i) => s + i.totalWithVat, 0);
    const totalAmountWithoutVatCents = invoices.reduce((s, i) => s + i.subtotalWithoutVat, 0);
    const overdueList = invoices.filter((i) => i.status === "overdue");
    const pendingList = invoices.filter((i) => i.status === "pending");
    const overdueAmountCents = overdueList.reduce((s, i) => s + i.totalWithVat, 0);
    const pendingAmountCents = pendingList.reduce((s, i) => s + i.totalWithVat, 0);
    return {
      total,
      totalAmountCents,
      totalAmountWithoutVatCents,
      overdue: overdueList.length,
      overdueAmountCents,
      pending: pendingList.length,
      pendingAmountCents,
    };
  }, [invoices]);

  return (
    <div className="min-h-screen bg-[#FAF6F3]">
      {/* Header */}
      <div className="border-b border-[#F5C992]/40 bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-stone-900">Faturas</h1>
            <p className="mt-0.5 text-sm text-stone-500">
              Gestão de faturas de fornecedores
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 rounded-md bg-gradient-to-r from-[#ED5C32] to-[#EF8935] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
            </svg>
            Nova fatura
          </button>
        </div>
      </div>

      <div className="space-y-6 p-6">
        {/* KPIs */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <KpiCard label="Total faturas" value={kpis.total} />
          <KpiCard
            label="Valor total"
            value={fromCents(kpis.totalAmountCents)}
            sub={`s/ IVA: ${fromCents(kpis.totalAmountWithoutVatCents)}`}
          />
          <KpiCard
            label="Vencidas"
            value={fromCents(kpis.overdueAmountCents)}
            sub={`${kpis.overdue} vencida${kpis.overdue !== 1 ? "s" : ""}`}
            accentClass="text-red-600"
          />
          <KpiCard
            label="Pendentes"
            value={fromCents(kpis.pendingAmountCents)}
            sub={`${kpis.pending} pendente${kpis.pending !== 1 ? "s" : ""}`}
            accentClass="text-amber-600"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar fornecedor ou nº fatura…"
            className="rounded-md border border-stone-300 bg-white px-3 py-2 text-sm focus:outline-none focus:border-[#ED5C32] w-64"
          />
          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as InvoiceStatus | "")
            }
            className="rounded-md border border-stone-300 bg-white px-3 py-2 text-sm focus:outline-none focus:border-[#ED5C32]"
          >
            <option value="">Todos os estados</option>
            {(
              Object.entries(INVOICE_STATUS_LABELS) as [InvoiceStatus, string][]
            ).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-xl border border-[#F5C992]/40 bg-white">
          {isLoading ? (
            <div className="py-16 text-center text-sm text-stone-400">
              A carregar…
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-sm text-stone-400">
              Sem faturas.
            </div>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="border-b border-[#F5C992]/40 bg-stone-50/60">
                <tr>
                  {[
                    "Estado",
                    "Fornecedor",
                    "Nº Fatura",
                    "Emissão",
                    "Vencimento",
                    "Pago em",
                    "S/ IVA",
                    "IVA",
                    "Total",
                    "A Pagar",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone-500"
                    >
                      {h}
                    </th>
                  ))}
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F5C992]/30">
                {filtered.map((inv) => (
                  <tr key={inv.id} className="hover:bg-[#FDF8F5]">
                    <td className="px-4 py-3">
                      <StatusBadge status={inv.status} />
                    </td>
                    <td className="px-4 py-3 font-medium text-stone-800">
                      {inv.supplierName}
                    </td>
                    <td className="px-4 py-3 text-stone-600">
                      {inv.invoiceNumber}
                    </td>
                    <td className="px-4 py-3 text-stone-600">
                      {formatDate(inv.invoiceDate)}
                    </td>
                    <td className="px-4 py-3 text-stone-600">
                      <span
                        className={
                          inv.status === "overdue"
                            ? "font-medium text-red-600"
                            : ""
                        }
                      >
                        {formatDate(inv.dueDate)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-stone-600">
                      {formatDate(inv.paidAt)}
                    </td>
                    <td className="px-4 py-3 text-right text-stone-700">
                      {fromCents(inv.subtotalWithoutVat)}
                    </td>
                    <td className="px-4 py-3 text-right text-stone-500">
                      {fromCents(inv.totalVat)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-stone-800">
                      {fromCents(inv.totalWithVat)}
                    </td>
                    <td className="px-4 py-3">
                      {payableByInvoiceId.has(inv.id) ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                          {PAYABLE_STATUS_LABELS[payableByInvoiceId.get(inv.id)!.status]}
                        </span>
                      ) : (
                        <span className="text-[10px] text-stone-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setDetail(inv)}
                        className="rounded-md px-2 py-1 text-xs font-medium text-[#ED5C32] hover:bg-orange-50"
                      >
                        Ver
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Drawers */}
        {showCreate && (
          <CreateInvoiceDrawer
            open={showCreate}
            suppliers={suppliers}
            saving={createMutation.isPending}
            onClose={() => setShowCreate(false)}
            onSave={(payload) => createMutation.mutate(payload)}
          />
        )}

        {detail && (
          <InvoiceDetailDrawer
            invoice={detail}
            costCenters={costCenters}
            linkedPayable={payableByInvoiceId.get(detail.id) ?? null}
            onClose={() => setDetail(null)}
            onMarkPaid={handleMarkPaid}
            markingPaid={markingPaidId === detail.id}
          />
        )}
      </div>

      <PageFooter />
    </div>
  );
}
