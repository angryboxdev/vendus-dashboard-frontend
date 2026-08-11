import { useState, useMemo } from "react";
import { NumericInput } from "../../../../components/NumericInput.tsx";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usePayableEntriesModule } from "../../payable-entries.module.tsx";
import { useInvoicesModule } from "../../../invoices/invoices.module.tsx";
import type { CreateInvoicePayload } from "../../../invoices/domain/entities/invoice.ts";
import {
  type PayableEntryDTO,
  type PayableStatus,
  type RecurrenceType,
  type CreatePayableEntryPayload,
  PAYABLE_STATUS_LABELS,
  RECURRENCE_LABELS,
} from "../../domain/entities/payable-entry.ts";
import { PageFooter } from "../../../../components/PageFooter.tsx";

// ── helpers ────────────────────────────────────────────────────────────────────

function fromCents(n: number): string {
  return (n / 100).toLocaleString("pt-PT", { style: "currency", currency: "EUR" });
}

function formatDate(s: string | null): string {
  if (!s) return "—";
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y}`;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function monthRange(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  return { from, to };
}

// ── StatusBadge ────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<PayableStatus, string> = {
  pending: "bg-amber-50 text-amber-700",
  paid: "bg-emerald-50 text-emerald-700",
  overdue: "bg-red-50 text-red-700",
  cancelled: "bg-stone-100 text-stone-500",
};

const STATUS_DOT: Record<PayableStatus, string> = {
  pending: "bg-amber-500",
  paid: "bg-emerald-500",
  overdue: "bg-red-500",
  cancelled: "bg-stone-400",
};

function StatusBadge({ status }: { status: PayableStatus }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[status]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[status]}`} />
      {PAYABLE_STATUS_LABELS[status]}
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

// ── Mini Calendar ──────────────────────────────────────────────────────────────

function MiniCalendar({ from, to }: { from: string; to: string }) {
  const { api } = usePayableEntriesModule();
  const { data: days = [] } = useQuery({
    queryKey: ["payable-calendar", from, to],
    queryFn: () => api.getPayableCalendar(from, to),
  });

  if (days.length === 0) {
    return (
      <p className="text-xs text-stone-400 py-4 text-center">Sem vencimentos no período.</p>
    );
  }

  return (
    <div className="space-y-1">
      {days.map((day) => (
        <div
          key={day.date}
          className="flex items-center justify-between rounded-md px-3 py-2 hover:bg-[#FDF8F5]"
        >
          <span className="text-xs text-stone-500">{formatDate(day.date)}</span>
          <span className="text-xs font-semibold text-stone-800">{fromCents(day.totalAmount)}</span>
        </div>
      ))}
    </div>
  );
}

// ── Detail Drawer ──────────────────────────────────────────────────────────────

interface DetailDrawerProps {
  entry: PayableEntryDTO;
  onClose: () => void;
  onMarkPaid: (id: string) => void;
  onCancel: (id: string) => void;
  markingPaid: boolean;
  cancelling: boolean;
}

function DetailDrawer({
  entry,
  onClose,
  onMarkPaid,
  onCancel,
  markingPaid,
  cancelling,
}: DetailDrawerProps) {
  const navigate = useNavigate();
  return (
    <div className="fixed inset-0 z-50 flex" aria-modal="true">
      <div className="flex-1 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <aside className="flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-[#F5C992]/40 px-6 py-4">
          <div>
            <p className="text-xs font-medium text-stone-400">Conta a pagar</p>
            <h2 className="text-lg font-bold text-stone-800">{entry.supplierName}</h2>
            <p className="text-sm text-stone-500">{entry.description}</p>
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

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Status + actions */}
          <div className="flex items-center justify-between">
            <StatusBadge status={entry.status} />
            <div className="flex gap-2">
              {(entry.status === "pending" || entry.status === "overdue") && (
                <>
                  <button
                    onClick={() => onMarkPaid(entry.id)}
                    disabled={markingPaid}
                    className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {markingPaid ? "A registar…" : "Marcar pago"}
                  </button>
                  <button
                    onClick={() => onCancel(entry.id)}
                    disabled={cancelling}
                    className="rounded-md border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-50"
                  >
                    {cancelling ? "A cancelar…" : "Cancelar"}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Amount */}
          <div className="rounded-xl border border-[#F5C992]/40 bg-[#FDF8F5] p-4 text-center">
            <p className="text-xs text-stone-400">Valor</p>
            <p className="mt-1 text-2xl font-bold text-stone-800">{fromCents(entry.amount)}</p>
          </div>

          {/* Fields */}
          <dl className="divide-y divide-stone-100">
            {[
              { label: "Fornecedor", value: entry.supplierName },
              { label: "Descrição", value: entry.description },
              { label: "Vencimento", value: formatDate(entry.dueDate) },
              { label: "Pago em", value: formatDate(entry.paidAt) },
              { label: "Recorrência", value: RECURRENCE_LABELS[entry.recurrence] },
              { label: "Categoria", value: entry.category ?? "—" },
              { label: "Notas", value: entry.notes ?? "—" },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between py-2">
                <dt className="text-xs text-stone-400">{label}</dt>
                <dd className="text-sm font-medium text-stone-700">{value}</dd>
              </div>
            ))}
          </dl>

          {/* Linked invoice */}
          {entry.invoiceId && (
            <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-3">
              <p className="text-xs font-medium text-blue-700 mb-2">Fatura associada</p>
              <p className="text-xs text-stone-500 mb-2 break-all">ID: {entry.invoiceId}</p>
              <button
                onClick={() => { onClose(); navigate(`/financial/invoices?open=${entry.invoiceId}`); }}
                className="text-xs font-medium text-blue-600 hover:text-blue-800 underline"
              >
                Ver fatura →
              </button>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

// ── Create Drawer ──────────────────────────────────────────────────────────────

interface CreateDrawerProps {
  open: boolean;
  saving: boolean;
  onClose: () => void;
  onSavePayable: (payload: CreatePayableEntryPayload) => void;
  onSaveInvoice: (payload: CreateInvoicePayload) => void;
}

function CreatePayableDrawer({ open, saving, onClose, onSavePayable, onSaveInvoice }: CreateDrawerProps) {
  const [hasInvoice, setHasInvoice] = useState(false);

  // Shared fields
  const [supplierName, setSupplierName] = useState("");
  const [dueDate, setDueDate] = useState(todayISO());
  const [notes, setNotes] = useState("");

  // Payable-only fields
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [recurrence, setRecurrence] = useState<RecurrenceType>("none");
  const [category, setCategory] = useState("");

  // Invoice-only fields
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(todayISO());
  const [subtotal, setSubtotal] = useState("");
  const [vatAmount, setVatAmount] = useState("0");

  if (!open) return null;

  const totalWithVat = (parseFloat(subtotal) || 0) + (parseFloat(vatAmount) || 0);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (hasInvoice) {
      const payload: CreateInvoicePayload = {
        supplierName,
        invoiceNumber,
        invoiceDate,
        dueDate,
        subtotalWithoutVat: Math.round((parseFloat(subtotal) || 0) * 100),
        totalVat: Math.round((parseFloat(vatAmount) || 0) * 100),
        totalWithVat: Math.round(totalWithVat * 100),
      };
      if (notes) payload.notes = notes;
      onSaveInvoice(payload);
    } else {
      const payload: CreatePayableEntryPayload = {
        supplierName,
        description,
        amount: Math.round(parseFloat(amount) * 100),
        dueDate,
        recurrence,
      };
      if (category) payload.category = category;
      if (notes) payload.notes = notes;
      onSavePayable(payload);
    }
  }

  const labelCls = "block text-xs font-medium text-stone-500 mb-1";
  const inputCls = "w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm focus:outline-none focus:border-[#ED5C32]";

  return (
    <div className="fixed inset-0 z-50 flex" aria-modal="true">
      <div className="flex-1 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <aside className="flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#F5C992]/40 px-6 py-4">
          <h2 className="text-lg font-bold text-stone-800">Novo Pagamento</h2>
          <button onClick={onClose} className="rounded-md p-1 text-stone-400 hover:bg-stone-100">
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-y-auto px-6 py-4">
          <div className="flex-1 space-y-4">

            {/* Invoice toggle */}
            <div className="rounded-lg border border-[#F5C992]/60 bg-[#FDF8F5] p-3">
              <p className="text-xs font-medium text-stone-600 mb-2">Esta despesa tem fatura de fornecedor?</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setHasInvoice(false)}
                  className={`flex-1 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                    !hasInvoice
                      ? "border-[#ED5C32] bg-[#ED5C32] text-white"
                      : "border-stone-300 bg-white text-stone-600 hover:bg-stone-50"
                  }`}
                >
                  Não
                </button>
                <button
                  type="button"
                  onClick={() => setHasInvoice(true)}
                  className={`flex-1 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                    hasInvoice
                      ? "border-[#ED5C32] bg-[#ED5C32] text-white"
                      : "border-stone-300 bg-white text-stone-600 hover:bg-stone-50"
                  }`}
                >
                  Sim — registar fatura
                </button>
              </div>
              {hasInvoice && (
                <p className="mt-2 text-xs text-stone-400">
                  A fatura será criada e a conta a pagar gerada automaticamente.
                </p>
              )}
            </div>

            {/* Shared: supplier */}
            <div>
              <label className={labelCls}>Fornecedor / entidade *</label>
              <input
                type="text"
                required
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                className={inputCls}
                placeholder="ex: EDP"
              />
            </div>

            {hasInvoice ? (
              <>
                {/* Invoice fields */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Nº da fatura *</label>
                    <input
                      type="text"
                      required
                      value={invoiceNumber}
                      onChange={(e) => setInvoiceNumber(e.target.value)}
                      className={inputCls}
                      placeholder="ex: FT2026/001"
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Data da fatura *</label>
                    <input
                      type="date"
                      required
                      value={invoiceDate}
                      onChange={(e) => setInvoiceDate(e.target.value)}
                      className={inputCls}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Valor s/IVA (€) *</label>
                    <NumericInput
                      required
                      value={subtotal}
                      onChange={(e) => setSubtotal(e.target.value)}
                      className={inputCls}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className={labelCls}>IVA (€)</label>
                    <NumericInput
                      value={vatAmount}
                      onChange={(e) => setVatAmount(e.target.value)}
                      className={inputCls}
                      placeholder="0.00"
                    />
                  </div>
                </div>
                {subtotal && (
                  <p className="text-xs text-stone-500">
                    Total c/IVA:{" "}
                    <span className="font-semibold text-stone-700">
                      {totalWithVat.toLocaleString("pt-PT", { style: "currency", currency: "EUR" })}
                    </span>
                  </p>
                )}
              </>
            ) : (
              <>
                {/* Payable-only fields */}
                <div>
                  <label className={labelCls}>Descrição *</label>
                  <input
                    type="text"
                    required
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className={inputCls}
                    placeholder="ex: Eletricidade julho"
                  />
                </div>
                <div>
                  <label className={labelCls}>Valor (€) *</label>
                  <NumericInput
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className={inputCls}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className={labelCls}>Recorrência</label>
                  <select
                    value={recurrence}
                    onChange={(e) => setRecurrence(e.target.value as RecurrenceType)}
                    className={inputCls}
                  >
                    {(Object.entries(RECURRENCE_LABELS) as [RecurrenceType, string][]).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Categoria</label>
                  <input
                    type="text"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className={inputCls}
                    placeholder="ex: Utilities"
                  />
                </div>
              </>
            )}

            {/* Shared: due date + notes */}
            <div>
              <label className={labelCls}>
                {hasInvoice ? "Data de vencimento *" : "Vencimento *"}
              </label>
              <input
                type="date"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Notas</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
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
              {saving ? "A guardar…" : "Criar"}
            </button>
          </div>
        </form>
      </aside>
    </div>
  );
}

// ── Main View ──────────────────────────────────────────────────────────────────

export function PayableEntriesView() {
  const { api } = usePayableEntriesModule();
  const { api: invoicesApi } = useInvoicesModule();
  const qc = useQueryClient();

  const [tab, setTab] = useState<"active" | "paid">("active");
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [detail, setDetail] = useState<PayableEntryDTO | null>(null);
  const [markingPaidId, setMarkingPaidId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const { from, to } = useMemo(() => monthRange(), []);

  // Fetch all entries — split client-side into tabs
  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["payable-entries"],
    queryFn: () => api.listPayableEntries(),
  });

  const { data: summary } = useQuery({
    queryKey: ["payable-summary"],
    queryFn: () => api.getPayableSummary(),
  });

  // Split + sort
  const activeEntries = useMemo(
    () =>
      entries
        .filter((e) => e.status === "pending" || e.status === "overdue")
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
    [entries],
  );

  const paidEntries = useMemo(
    () =>
      entries
        .filter((e) => e.status === "paid")
        .sort((a, b) => (b.paidAt ?? "").localeCompare(a.paidAt ?? "")),
    [entries],
  );

  // KPIs for the paid tab
  const paidKpis = useMemo(() => {
    const thisMonth = new Date().toISOString().slice(0, 7);
    const thisMonthEntries = paidEntries.filter((e) => e.paidAt?.startsWith(thisMonth));
    return {
      total: paidEntries.length,
      totalAmount: paidEntries.reduce((s, e) => s + e.amount, 0),
      thisMonthAmount: thisMonthEntries.reduce((s, e) => s + e.amount, 0),
      thisMonthCount: thisMonthEntries.length,
    };
  }, [paidEntries]);

  function invalidateAll() {
    void qc.invalidateQueries({ queryKey: ["payable-entries"] });
    void qc.invalidateQueries({ queryKey: ["payable-summary"] });
    void qc.invalidateQueries({ queryKey: ["payable-calendar"] });
  }

  const createMutation = useMutation({
    mutationFn: (payload: CreatePayableEntryPayload) => api.createPayableEntry(payload),
    onSuccess: () => {
      invalidateAll();
      setShowCreate(false);
    },
  });

  const createFromInvoiceMutation = useMutation({
    mutationFn: (payload: CreateInvoicePayload) => invoicesApi.createInvoice(payload),
    onSuccess: () => {
      invalidateAll();
      void qc.invalidateQueries({ queryKey: ["invoices"] });
      setShowCreate(false);
    },
  });

  async function handleMarkPaid(id: string) {
    setMarkingPaidId(id);
    try {
      const updated = await api.markPayableAsPaid(id);
      invalidateAll();
      if (detail?.id === id) setDetail(updated);
    } finally {
      setMarkingPaidId(null);
    }
  }

  async function handleCancel(id: string) {
    setCancellingId(id);
    try {
      const updated = await api.cancelPayableEntry(id);
      void qc.invalidateQueries({ queryKey: ["payable-entries"] });
      void qc.invalidateQueries({ queryKey: ["payable-summary"] });
      if (detail?.id === id) setDetail(updated);
    } finally {
      setCancellingId(null);
    }
  }

  const currentEntries = tab === "active" ? activeEntries : paidEntries;

  const filtered = useMemo(() => {
    if (!search) return currentEntries;
    const q = search.toLowerCase();
    return currentEntries.filter(
      (e) =>
        e.supplierName.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q),
    );
  }, [currentEntries, search]);

  return (
    <div className="min-h-screen bg-[#FAF6F3]">
      {/* Header */}
      <div className="border-b border-[#F5C992]/40 bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-stone-900">Contas a Pagar</h1>
            <p className="mt-0.5 text-sm text-stone-500">
              Gestão de pagamentos e despesas pendentes
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 rounded-md bg-gradient-to-r from-[#ED5C32] to-[#EF8935] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
            </svg>
            Novo pagamento
          </button>
        </div>

        {/* Tabs */}
        <div className="flex mt-4 -mb-4 gap-1">
          <button
            onClick={() => setTab("active")}
            className={`-mb-px border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
              tab === "active"
                ? "border-[#ED5C32] text-[#ED5C32]"
                : "border-transparent text-stone-500 hover:text-stone-700"
            }`}
          >
            A Pagar
            {activeEntries.length > 0 && (
              <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-semibold ${
                tab === "active" ? "bg-[#ED5C32]/10 text-[#ED5C32]" : "bg-stone-100 text-stone-500"
              }`}>
                {activeEntries.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab("paid")}
            className={`-mb-px border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
              tab === "paid"
                ? "border-[#ED5C32] text-[#ED5C32]"
                : "border-transparent text-stone-500 hover:text-stone-700"
            }`}
          >
            Pagas
            {paidEntries.length > 0 && (
              <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-semibold ${
                tab === "paid" ? "bg-[#ED5C32]/10 text-[#ED5C32]" : "bg-stone-100 text-stone-500"
              }`}>
                {paidEntries.length}
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="flex gap-6 p-6">
        {/* Main content */}
        <div className="flex-1 space-y-6">

          {/* KPIs — contextual per tab */}
          {tab === "active" ? (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <KpiCard
                label="Total a pagar"
                value={summary ? fromCents(summary.totalDue) : "—"}
              />
              <KpiCard
                label="Vencido"
                value={summary ? fromCents(summary.totalOverdue) : "—"}
                accentClass="text-red-600"
              />
              <KpiCard
                label="Vence em 7 dias"
                value={summary ? fromCents(summary.dueSoon7Days) : "—"}
                accentClass="text-amber-600"
              />
              <KpiCard
                label="Entradas pendentes"
                value={activeEntries.length}
                sub={`${activeEntries.filter(e => e.status === "overdue").length} vencida${activeEntries.filter(e => e.status === "overdue").length !== 1 ? "s" : ""}`}
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              <KpiCard
                label="Pago este mês"
                value={fromCents(paidKpis.thisMonthAmount)}
                sub={`${paidKpis.thisMonthCount} pagamento${paidKpis.thisMonthCount !== 1 ? "s" : ""}`}
                accentClass="text-emerald-600"
              />
              <KpiCard
                label="Total histórico pago"
                value={fromCents(paidKpis.totalAmount)}
                sub={`${paidKpis.total} entrada${paidKpis.total !== 1 ? "s" : ""}`}
              />
              <KpiCard
                label="Pago com fatura"
                value={paidEntries.filter(e => e.invoiceId).length}
                sub={`de ${paidKpis.total} total`}
              />
            </div>
          )}

          {/* Search */}
          <div>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Pesquisar fornecedor ou descrição…"
              className="rounded-md border border-stone-300 bg-white px-3 py-2 text-sm focus:outline-none focus:border-[#ED5C32] w-72"
            />
          </div>

          {/* Table */}
          <div className="overflow-hidden rounded-xl border border-[#F5C992]/40 bg-white">
            {isLoading ? (
              <div className="py-16 text-center text-sm text-stone-400">A carregar…</div>
            ) : filtered.length === 0 ? (
              <div className="py-16 text-center text-sm text-stone-400">
                {tab === "active" ? "Sem contas a pagar pendentes." : "Sem pagamentos registados."}
              </div>
            ) : tab === "active" ? (
              <table className="min-w-full text-sm">
                <thead className="border-b border-[#F5C992]/40 bg-stone-50/60">
                  <tr>
                    {["Estado", "Fornecedor", "Descrição", "Vencimento", "Recorrência", "Valor", ""].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F5C992]/30">
                  {filtered.map((entry) => (
                    <tr key={entry.id} className={`hover:bg-[#FDF8F5] ${entry.status === "overdue" ? "bg-red-50/30" : ""}`}>
                      <td className="px-4 py-3">
                        <StatusBadge status={entry.status} />
                      </td>
                      <td className="px-4 py-3 font-medium text-stone-800">
                        {entry.supplierName}
                      </td>
                      <td className="px-4 py-3 text-stone-600 max-w-[200px]">
                        <span className="block truncate">{entry.description}</span>
                        {entry.invoiceId && (
                          <span className="inline-flex items-center gap-1 mt-0.5 rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-600">
                            <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
                            De fatura
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={entry.status === "overdue" ? "font-medium text-red-600" : "text-stone-600"}>
                          {formatDate(entry.dueDate)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-stone-500 text-xs">
                        {RECURRENCE_LABELS[entry.recurrence]}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-stone-800">
                        {fromCents(entry.amount)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setDetail(entry)}
                          className="rounded-md px-2 py-1 text-xs font-medium text-[#ED5C32] hover:bg-orange-50"
                        >
                          Ver
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="min-w-full text-sm">
                <thead className="border-b border-[#F5C992]/40 bg-stone-50/60">
                  <tr>
                    {["Fornecedor", "Descrição", "Vencimento", "Pago em", "Valor", ""].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F5C992]/30">
                  {filtered.map((entry) => (
                    <tr key={entry.id} className="hover:bg-[#FDF8F5]">
                      <td className="px-4 py-3 font-medium text-stone-800">
                        {entry.supplierName}
                      </td>
                      <td className="px-4 py-3 text-stone-600 max-w-[200px]">
                        <span className="block truncate">{entry.description}</span>
                        {entry.invoiceId && (
                          <span className="inline-flex items-center gap-1 mt-0.5 rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-600">
                            <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
                            De fatura
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-stone-500 text-xs">
                        {formatDate(entry.dueDate)}
                      </td>
                      <td className="px-4 py-3 text-emerald-700 font-medium text-xs">
                        {formatDate(entry.paidAt)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-stone-800">
                        {fromCents(entry.amount)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setDetail(entry)}
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
        </div>

        {/* Calendar sidebar — only on active tab */}
        {tab === "active" && (
          <aside className="hidden xl:block w-72 shrink-0 space-y-4">
            <div className="rounded-xl border border-[#F5C992]/40 bg-white p-4">
              <h3 className="mb-3 text-sm font-semibold text-stone-700">
                Vencimentos este mês
              </h3>
              <MiniCalendar from={from} to={to} />
            </div>
          </aside>
        )}
      </div>

      {/* Drawers */}
      <CreatePayableDrawer
        open={showCreate}
        saving={createMutation.isPending || createFromInvoiceMutation.isPending}
        onClose={() => setShowCreate(false)}
        onSavePayable={(payload) => createMutation.mutate(payload)}
        onSaveInvoice={(payload) => createFromInvoiceMutation.mutate(payload)}
      />

      {detail && (
        <DetailDrawer
          entry={detail}
          onClose={() => setDetail(null)}
          onMarkPaid={handleMarkPaid}
          onCancel={handleCancel}
          markingPaid={markingPaidId === detail.id}
          cancelling={cancellingId === detail.id}
        />
      )}

      <PageFooter />
    </div>
  );
}
