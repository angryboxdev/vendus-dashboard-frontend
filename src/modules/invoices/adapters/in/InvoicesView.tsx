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
  type CreateInvoiceLinePayload,
  type InvoiceImportResultDTO,
  INVOICE_STATUS_LABELS,
  INVOICE_LINE_TYPE_LABELS,
} from "../../domain/entities/invoice.ts";
import { ImportInvoiceModal } from "./ImportInvoiceModal.tsx";
import { ReviewImportedInvoiceDrawer } from "./ReviewImportedInvoiceDrawer.tsx";
import { useFinancialBaseModule } from "../../../financial-base/financial-base.module.tsx";
import type { CostCenterCategory } from "../../../financial-base/domain/entities/cost-center.ts";
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
  draft_ai: "bg-stone-100 text-stone-500",
  pending_review: "bg-purple-50 text-purple-700",
  pending: "bg-amber-50 text-amber-700",
  paid: "bg-emerald-50 text-emerald-700",
  overdue: "bg-red-50 text-red-700",
  partial: "bg-blue-50 text-blue-700",
  cancelled: "bg-stone-100 text-stone-500",
  review: "bg-purple-50 text-purple-700",
};

const STATUS_DOT: Record<InvoiceStatus, string> = {
  draft_ai: "bg-stone-400",
  pending_review: "bg-purple-500",
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
  categories: CostCenterCategory[];
  onDone: (updated: InvoiceLineDTO) => void;
}

function ClassifyPanel({
  line,
  invoiceId,
  categories,
  onDone,
}: ClassifyPanelProps) {
  const { api } = useInvoicesModule();
  const [type, setType] = useState<InvoiceLineType>(line.type);
  const [catId, setCatId] = useState(line.costCenterCategoryId ?? "");
  const [category, setCategory] = useState(line.category ?? "");
  const [saveRule, setSaveRule] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const updated = await api.classifyLine(invoiceId, line.id, {
        classify: {
          type,
          costCenterCategoryId: catId || null,
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
            Subcategoria
          </label>
          <select
            value={catId}
            onChange={(e) => setCatId(e.target.value)}
            className="w-full rounded-md border border-stone-300 bg-white px-2 py-1.5 text-xs focus:outline-none focus:border-[#ED5C32]"
          >
            <option value="">— nenhuma —</option>
            {categories.filter((c) => c.isActive).map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} — {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-stone-500">
          Categoria livre
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

// ── Add Line Form ──────────────────────────────────────────────────────────────

interface AddLineFormProps {
  invoiceId: string;
  categories: CostCenterCategory[];
  onDone: (line: InvoiceLineDTO) => void;
  onCancel: () => void;
}

function AddLineForm({ invoiceId, categories, onDone, onCancel }: AddLineFormProps) {
  const { api } = useInvoicesModule();
  const [description, setDescription] = useState("");
  const [type, setType]               = useState<InvoiceLineType>("other");
  const [quantity, setQuantity]       = useState("1");
  const [unit, setUnit]               = useState("");
  const [unitCost, setUnitCost]       = useState("");
  const [vatRate, setVatRate]         = useState("23");
  const [catId, setCatId]             = useState("");
  const [category, setCategory]       = useState("");
  const [saving, setSaving]           = useState(false);

  const subtotal   = parseFloat(quantity || "0") * parseFloat(unitCost || "0");
  const vatAmount  = Math.round(subtotal * (parseFloat(vatRate) / 100) * 100);
  const totalCents = Math.round(subtotal * 100) + vatAmount;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!description || !unitCost) return;
    setSaving(true);
    try {
      const line = await api.addLine(invoiceId, {
        description,
        type,
        quantity: parseFloat(quantity),
        unit: unit || null,
        unitCostWithoutVat: Math.round(parseFloat(unitCost || "0") * 100),
        vatRate: parseFloat(vatRate),
        vatAmount,
        totalWithVat: totalCents,
        costCenterCategoryId: catId || null,
        category: category || null,
      });
      onDone(line);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      className="space-y-3 rounded-lg border border-[#F5C992]/60 bg-[#FDF8F5] p-3 text-sm"
    >
      <p className="text-xs font-semibold text-stone-600">Nova linha</p>
      <div>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Descrição *"
          required
          className="w-full rounded-md border border-stone-300 bg-white px-2 py-1.5 text-xs focus:outline-none focus:border-[#ED5C32]"
        />
      </div>
      {/* Type */}
      <div>
        <label className="mb-1 block text-xs font-medium text-stone-500">Tipo</label>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as InvoiceLineType)}
          className="w-full rounded-md border border-stone-300 bg-white px-2 py-1.5 text-xs focus:outline-none focus:border-[#ED5C32]"
        >
          {(Object.entries(INVOICE_LINE_TYPE_LABELS) as [InvoiceLineType, string][]).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <input
            type="number"
            min="0.001"
            step="any"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="Qtd *"
            required
            className="w-full rounded-md border border-stone-300 bg-white px-2 py-1.5 text-xs focus:outline-none focus:border-[#ED5C32]"
          />
        </div>
        <div>
          <input
            type="text"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            placeholder="Unidade (ex: kg)"
            className="w-full rounded-md border border-stone-300 bg-white px-2 py-1.5 text-xs focus:outline-none focus:border-[#ED5C32]"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <input
            type="number"
            min="0"
            step="any"
            value={unitCost}
            onChange={(e) => setUnitCost(e.target.value)}
            placeholder="Preço unit. s/ IVA (€) *"
            required
            className="w-full rounded-md border border-stone-300 bg-white px-2 py-1.5 text-xs focus:outline-none focus:border-[#ED5C32]"
          />
        </div>
        <div>
          <select
            value={vatRate}
            onChange={(e) => setVatRate(e.target.value)}
            className="w-full rounded-md border border-stone-300 bg-white px-2 py-1.5 text-xs focus:outline-none focus:border-[#ED5C32]"
          >
            <option value="0">IVA 0%</option>
            <option value="6">IVA 6%</option>
            <option value="13">IVA 13%</option>
            <option value="23">IVA 23%</option>
          </select>
        </div>
      </div>
      {/* CC subcategory + free category */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <select
            value={catId}
            onChange={(e) => setCatId(e.target.value)}
            className="w-full rounded-md border border-stone-300 bg-white px-2 py-1.5 text-xs focus:outline-none focus:border-[#ED5C32]"
          >
            <option value="">Subcategoria CC</option>
            {categories.filter((c) => c.isActive).map((c) => (
              <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <input
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Categoria livre"
            className="w-full rounded-md border border-stone-300 bg-white px-2 py-1.5 text-xs focus:outline-none focus:border-[#ED5C32]"
          />
        </div>
      </div>
      {subtotal > 0 && (
        <p className="text-xs text-stone-500 tabular-nums">
          Total c/ IVA: <span className="font-semibold text-stone-800">
            {(totalCents / 100).toLocaleString("pt-PT", { style: "currency", currency: "EUR" })}
          </span>
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-md border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={saving || !description || !unitCost}
          className="flex-1 rounded-md bg-gradient-to-r from-[#ED5C32] to-[#EF8935] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "A guardar…" : "Adicionar"}
        </button>
      </div>
    </form>
  );
}

// ── Invoice Detail Drawer ──────────────────────────────────────────────────────

interface DetailDrawerProps {
  invoice: InvoiceDTO | null;
  categories: CostCenterCategory[];
  linkedPayable?: PayableEntryDTO | null;
  onClose: () => void;
  onMarkPaid: (id: string) => void;
  markingPaid: boolean;
}

function InvoiceDetailDrawer({
  invoice,
  categories,
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
  const [showAddLine, setShowAddLine] = useState(false);

  // Reload lines from API when switching to lines tab
  async function loadLines(inv: InvoiceDTO) {
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

  function handleLineAdded(newLine: InvoiceLineDTO) {
    setLines((prev) => [...prev, newLine]);
    setShowAddLine(false);
    void qc.invalidateQueries({ queryKey: ["invoices"] });
    void qc.invalidateQueries({ queryKey: ["invoice-lines-all"] });
  }

  if (!invoice) return null;

  const ccMap = new Map(categories.map((c) => [c.id, c]));

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
              {/* Add line button */}
              {!showAddLine && (
                <button
                  onClick={() => setShowAddLine(true)}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-stone-300 py-2 text-xs font-medium text-stone-500 hover:border-[#ED5C32] hover:text-[#ED5C32]"
                >
                  <span className="text-base leading-none">+</span> Adicionar linha
                </button>
              )}

              {/* Inline add-line form */}
              {showAddLine && (
                <AddLineForm
                  invoiceId={invoice.id}
                  categories={categories}
                  onDone={handleLineAdded}
                  onCancel={() => setShowAddLine(false)}
                />
              )}

              {loadingLines ? (
                <p className="text-sm text-stone-400">A carregar linhas…</p>
              ) : lines.length === 0 ? (
                <p className="text-sm text-stone-400">Sem linhas registadas.</p>
              ) : (
                lines.map((line) => {
                  const cc = line.costCenterCategoryId
                    ? ccMap.get(line.costCenterCategoryId)
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
                        categories={categories}
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
  categories: CostCenterCategory[];
  saving: boolean;
  onClose: () => void;
  onSave: (payload: CreateInvoicePayload) => void;
}

// Mini line builder used inside CreateInvoiceDrawer
interface LineBuilder {
  description: string;
  type: InvoiceLineType;
  quantity: string;
  unit: string;
  unitCost: string;
  vatRate: string;
  catId: string;
  category: string;
}

function emptyLineBuilder(): LineBuilder {
  return { description: "", type: "other", quantity: "1", unit: "", unitCost: "", vatRate: "23", catId: "", category: "" };
}

function lineBuilderToPayload(b: LineBuilder): CreateInvoiceLinePayload {
  const unitCostEur = parseFloat(b.unitCost || "0");
  const subtotal    = parseFloat(b.quantity || "0") * unitCostEur;
  const vatAmount   = Math.round(subtotal * (parseFloat(b.vatRate) / 100) * 100);
  const payload: CreateInvoiceLinePayload = {
    description: b.description,
    type: b.type,
    quantity: parseFloat(b.quantity),
    unitCostWithoutVat: Math.round(unitCostEur * 100),
    vatRate: parseFloat(b.vatRate),
    vatAmount,
    totalWithVat: Math.round(subtotal * 100) + vatAmount,
  };
  if (b.unit) payload.unit = b.unit;
  if (b.catId) payload.costCenterCategoryId = b.catId;
  if (b.category) payload.category = b.category;
  return payload;
}

function CreateInvoiceDrawer({
  open,
  suppliers,
  categories,
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
  const [lines, setLines] = useState<CreateInvoiceLinePayload[]>([]);
  const [addingLine, setAddingLine] = useState(false);
  const [lineBuilder, setLineBuilder] = useState<LineBuilder>(emptyLineBuilder);

  if (!open) return null;

  function handleSupplierChange(id: string) {
    setSupplierId(id);
    if (id) {
      const sup = suppliers.find((s) => s.id === id);
      if (sup) setSupplierName(sup.name);
    }
  }

  function handleAddLine() {
    if (!lineBuilder.description || !lineBuilder.unitCost) return;
    setLines((prev) => [...prev, lineBuilderToPayload(lineBuilder)]);
    setLineBuilder(emptyLineBuilder());
    setAddingLine(false);
  }

  function handleRemoveLine(idx: number) {
    setLines((prev) => prev.filter((_, i) => i !== idx));
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
    if (lines.length > 0) payload.lines = lines;
    onSave(payload);
  }

  const labelCls = "block text-xs font-medium text-stone-500 mb-1";
  const inputCls =
    "w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm focus:outline-none focus:border-[#ED5C32]";
  const inputSmCls =
    "w-full rounded-md border border-stone-300 bg-white px-2 py-1.5 text-xs focus:outline-none focus:border-[#ED5C32]";

  const lbSubtotal = parseFloat(lineBuilder.quantity || "0") * parseFloat(lineBuilder.unitCost || "0");
  const lbTotal = Math.round(lbSubtotal * 100) + Math.round(lbSubtotal * (parseFloat(lineBuilder.vatRate) / 100) * 100);

  return (
    <div className="fixed inset-0 z-50 flex" aria-modal="true">
      <div className="flex-1 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <aside className="flex h-full w-full max-w-lg flex-col bg-white shadow-2xl">
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
                rows={2}
                className={inputCls}
                placeholder="Opcional"
              />
            </div>

            {/* Lines section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-stone-500">Linhas</label>
                <span className="text-xs text-stone-400">{lines.length} linha{lines.length !== 1 ? "s" : ""}</span>
              </div>

              {/* Added lines list */}
              {lines.length > 0 && (
                <ul className="space-y-1">
                  {lines.map((l, i) => (
                    <li key={i} className="flex items-center justify-between rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-xs">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-stone-700">{l.description}</p>
                        <p className="text-stone-400">
                          {INVOICE_LINE_TYPE_LABELS[l.type ?? "other"]} ·{" "}
                          {(l.totalWithVat / 100).toLocaleString("pt-PT", { style: "currency", currency: "EUR" })}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveLine(i)}
                        className="ml-2 shrink-0 text-stone-400 hover:text-red-500"
                      >
                        <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                        </svg>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {/* Add line mini-form */}
              {addingLine ? (
                <div className="space-y-2 rounded-lg border border-[#F5C992]/60 bg-[#FDF8F5] p-3">
                  <input
                    type="text"
                    value={lineBuilder.description}
                    onChange={(e) => setLineBuilder((b) => ({ ...b, description: e.target.value }))}
                    placeholder="Descrição *"
                    className={inputSmCls}
                  />
                  <select
                    value={lineBuilder.type}
                    onChange={(e) => setLineBuilder((b) => ({ ...b, type: e.target.value as InvoiceLineType }))}
                    className={inputSmCls}
                  >
                    {(Object.entries(INVOICE_LINE_TYPE_LABELS) as [InvoiceLineType, string][]).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      min="0.001"
                      step="any"
                      value={lineBuilder.quantity}
                      onChange={(e) => setLineBuilder((b) => ({ ...b, quantity: e.target.value }))}
                      placeholder="Qtd *"
                      className={inputSmCls}
                    />
                    <input
                      type="text"
                      value={lineBuilder.unit}
                      onChange={(e) => setLineBuilder((b) => ({ ...b, unit: e.target.value }))}
                      placeholder="Unidade"
                      className={inputSmCls}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={lineBuilder.unitCost}
                      onChange={(e) => setLineBuilder((b) => ({ ...b, unitCost: e.target.value }))}
                      placeholder="Preço s/ IVA (€) *"
                      className={inputSmCls}
                    />
                    <select
                      value={lineBuilder.vatRate}
                      onChange={(e) => setLineBuilder((b) => ({ ...b, vatRate: e.target.value }))}
                      className={inputSmCls}
                    >
                      <option value="0">IVA 0%</option>
                      <option value="6">IVA 6%</option>
                      <option value="13">IVA 13%</option>
                      <option value="23">IVA 23%</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={lineBuilder.catId}
                      onChange={(e) => setLineBuilder((b) => ({ ...b, catId: e.target.value }))}
                      className={inputSmCls}
                    >
                      <option value="">Subcategoria CC</option>
                      {categories.filter((c) => c.isActive).map((c) => (
                        <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={lineBuilder.category}
                      onChange={(e) => setLineBuilder((b) => ({ ...b, category: e.target.value }))}
                      placeholder="Categoria livre"
                      className={inputSmCls}
                    />
                  </div>
                  {lbSubtotal > 0 && (
                    <p className="text-xs text-stone-500 tabular-nums">
                      Total c/ IVA:{" "}
                      <span className="font-semibold text-stone-800">
                        {(lbTotal / 100).toLocaleString("pt-PT", { style: "currency", currency: "EUR" })}
                      </span>
                    </p>
                  )}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => { setAddingLine(false); setLineBuilder(emptyLineBuilder()); }}
                      className="flex-1 rounded-md border border-stone-300 px-2 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleAddLine}
                      disabled={!lineBuilder.description || !lineBuilder.unitCost}
                      className="flex-1 rounded-md bg-stone-800 px-2 py-1.5 text-xs font-medium text-white hover:bg-stone-700 disabled:opacity-40"
                    >
                      Adicionar
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setAddingLine(true)}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-stone-300 py-2 text-xs font-medium text-stone-500 hover:border-[#ED5C32] hover:text-[#ED5C32]"
                >
                  <span className="text-base leading-none">+</span> Adicionar linha
                </button>
              )}
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

// ── Invoice Calendar View ──────────────────────────────────────────────────────

const MONTH_NAMES_PT = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];
const DOW_NAMES_PT = ["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"];

const STATUS_CHIP_BG: Record<InvoiceStatus, string> = {
  draft_ai:       "#f5f5f4",
  pending_review: "#faf5ff",
  pending:        "#fffbeb",
  paid:           "#f0fdf4",
  overdue:        "#fef2f2",
  partial:        "#eff6ff",
  cancelled:      "#f5f5f4",
  review:         "#faf5ff",
};

interface InvoiceCalendarViewProps {
  invoicesByDate: Map<string, InvoiceDTO[]>;
  noDueDateInvoices: InvoiceDTO[];
  month: Date;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
  onInvoiceClick: (inv: InvoiceDTO) => void;
}

function InvoiceCalendarView({
  invoicesByDate,
  noDueDateInvoices,
  month,
  onPrevMonth,
  onNextMonth,
  onToday,
  onInvoiceClick,
}: InvoiceCalendarViewProps) {
  const year = month.getFullYear();
  const monthIdx = month.getMonth();

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  const firstDayDow = (new Date(year, monthIdx, 1).getDay() + 6) % 7; // Mon=0
  const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDayDow).fill(null) as null[],
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-xl border border-[#F5C992]/40 bg-white">
        {/* Month navigation */}
        <div className="flex items-center justify-between border-b border-[#F5C992]/40 px-4 py-3">
          <div className="flex items-center gap-1">
            <button
              onClick={onPrevMonth}
              className="rounded-md p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-600"
            >
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
              </svg>
            </button>
            <h2 className="w-44 text-center text-sm font-semibold text-stone-800">
              {MONTH_NAMES_PT[monthIdx]} {year}
            </h2>
            <button
              onClick={onNextMonth}
              className="rounded-md p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-600"
            >
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
          <button
            onClick={onToday}
            className="rounded-md border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50"
          >
            Hoje
          </button>
        </div>

        {/* Day-of-week headers */}
        <div className="grid grid-cols-7 border-b border-[#F5C992]/40 bg-stone-50/40">
          {DOW_NAMES_PT.map((d) => (
            <div key={d} className="py-2 text-center text-xs font-semibold text-stone-400">
              {d}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 divide-x divide-y divide-[#F5C992]/20">
          {cells.map((day, i) => {
            if (day === null) {
              return <div key={`pad-${i}`} className="min-h-[110px] bg-stone-50/30" />;
            }
            const dateStr = `${year}-${String(monthIdx + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const dayInvs = invoicesByDate.get(dateStr) ?? [];
            const isToday = dateStr === todayStr;
            const hasOverdue = dayInvs.some((inv) => inv.status === "overdue");
            const visible = dayInvs.slice(0, 3);
            const extra = dayInvs.length - visible.length;

            return (
              <div
                key={dateStr}
                className={`min-h-[110px] p-1.5 ${isToday ? "bg-orange-50/50" : ""}`}
              >
                <div className="mb-1 flex justify-end">
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                      isToday
                        ? "bg-[#ED5C32] text-white"
                        : hasOverdue && dayInvs.length > 0
                          ? "text-red-500"
                          : "text-stone-400"
                    }`}
                  >
                    {day}
                  </span>
                </div>
                <div className="space-y-0.5">
                  {visible.map((inv) => (
                    <button
                      key={inv.id}
                      onClick={() => onInvoiceClick(inv)}
                      title={`${inv.supplierName} · ${fromCents(inv.totalWithVat)}`}
                      className="flex w-full items-center gap-1 rounded px-1.5 py-0.5 text-left transition-opacity hover:opacity-75"
                      style={{ backgroundColor: STATUS_CHIP_BG[inv.status] }}
                    >
                      <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${STATUS_DOT[inv.status]}`} />
                      <span className="min-w-0 truncate text-[10px] font-medium leading-tight text-stone-700">
                        {inv.supplierName}
                      </span>
                    </button>
                  ))}
                  {extra > 0 && (
                    <p className="pl-1 text-[9px] font-medium text-stone-400">+{extra} mais</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Invoices without due date */}
      {noDueDateInvoices.length > 0 && (
        <div className="rounded-xl border border-[#F5C992]/40 bg-white px-4 py-3">
          <p className="mb-2 text-xs font-semibold text-stone-500">
            Sem data de vencimento ({noDueDateInvoices.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {noDueDateInvoices.map((inv) => (
              <button
                key={inv.id}
                onClick={() => onInvoiceClick(inv)}
                className="flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-2.5 py-1 text-xs font-medium text-stone-600 hover:bg-stone-50"
              >
                <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[inv.status]}`} />
                {inv.supplierName}
              </button>
            ))}
          </div>
        </div>
      )}
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

  const [viewMode, setViewMode] = useState<"table" | "calendar">("table");
  const [calendarMonth, setCalendarMonth] = useState<Date>(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | "">("");
  const [activeTab, setActiveTab] = useState<"all" | "today" | "week" | "overdue">("all");
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importResult, setImportResult] = useState<InvoiceImportResultDTO | null>(null);
  const [detail, setDetail] = useState<InvoiceDTO | null>(null);
  const [markingPaidId, setMarkingPaidId] = useState<string | null>(null);

  // Data
  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["invoices", statusFilter],
    queryFn: () =>
      api.listInvoices(statusFilter ? { status: statusFilter } : undefined),
  });

  const { data: alerts } = useQuery({
    queryKey: ["invoice-alerts"],
    queryFn: () => api.getInvoiceAlerts(),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["cost-center-categories"],
    queryFn: () => fbModule.api.listCostCenterCategories(),
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

  const supplierById = useMemo(
    () => new Map(suppliers.map((s) => [s.id, s])),
    [suppliers],
  );

  const categoryById = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  );

  const invoicesByDueDate = useMemo(() => {
    const map = new Map<string, InvoiceDTO[]>();
    for (const inv of invoices) {
      const dateKey = inv.dueDate ?? inv.paidAt;
      if (!dateKey) continue;
      const list = map.get(dateKey) ?? [];
      list.push(inv);
      map.set(dateKey, list);
    }
    return map;
  }, [invoices]);

  const noDueDateInvoices = useMemo(
    () =>
      invoices.filter(
        (i) => !i.dueDate && !i.paidAt && !["paid", "cancelled"].includes(i.status),
      ),
    [invoices],
  );

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
      void qc.invalidateQueries({ queryKey: ["invoice-lines-all"] });
      setShowCreate(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteInvoice(id),
    onSuccess: (_data, id) => {
      void qc.invalidateQueries({ queryKey: ["invoices"] });
      void qc.invalidateQueries({ queryKey: ["invoice-alerts"] });
      if (detail?.id === id) setDetail(null);
      if (importResult?.invoice.id === id) setImportResult(null);
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

  async function handleRowReview(inv: InvoiceDTO) {
    const full = await api.getInvoice(inv.id);
    setImportResult({
      invoice: full,
      aiConfidence: full.aiConfidence ?? 0,
      validationIssues: [],
      supplierMatch: null,
      extractedLines: [],
    });
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

  // Tab helpers
  function getTodayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function getIn7DaysStr() {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  const tabCounts = useMemo(() => {
    const today = getTodayStr();
    const in7 = getIn7DaysStr();
    return {
      all: invoices.length,
      today: invoices.filter(
        (i) => i.dueDate === today && !["paid", "cancelled"].includes(i.status),
      ).length,
      week: invoices.filter(
        (i) =>
          i.dueDate != null &&
          i.dueDate > today &&
          i.dueDate <= in7 &&
          !["paid", "cancelled"].includes(i.status),
      ).length,
      overdue: invoices.filter((i) => i.status === "overdue").length,
    };
  }, [invoices]);

  const tabFiltered = useMemo(() => {
    const today = getTodayStr();
    const in7 = getIn7DaysStr();
    switch (activeTab) {
      case "today":
        return filtered.filter(
          (i) => i.dueDate === today && !["paid", "cancelled"].includes(i.status),
        );
      case "week":
        return filtered.filter(
          (i) =>
            i.dueDate != null &&
            i.dueDate > today &&
            i.dueDate <= in7 &&
            !["paid", "cancelled"].includes(i.status),
        );
      case "overdue":
        return filtered.filter((i) => i.status === "overdue");
      default:
        return filtered;
    }
  }, [filtered, activeTab]);

  function handleTabChange(tab: "all" | "today" | "week" | "overdue") {
    setActiveTab(tab);
    if (tab !== "all") setStatusFilter("");
  }

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
          <div className="flex items-center gap-3">
            {/* View mode toggle */}
            <div className="flex rounded-md border border-stone-200 bg-stone-50 p-0.5">
              <button
                onClick={() => setViewMode("table")}
                title="Vista tabela"
                className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                  viewMode === "table"
                    ? "bg-white text-stone-800 shadow-sm"
                    : "text-stone-500 hover:text-stone-700"
                }`}
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M.99 5.24A2.25 2.25 0 013.25 3h13.5A2.25 2.25 0 0119 5.25l.01 9.5A2.25 2.25 0 0116.76 17H3.26A2.272 2.272 0 011 14.75l-.01-9.51zm8.26 9.52v-.625a.75.75 0 00-.75-.75H3.25a.75.75 0 00-.75.75v.615c0 .414.336.75.75.75h5.373a.75.75 0 00.627-.74zm1.5 0a.75.75 0 00.627.74h5.373a.75.75 0 00.75-.75v-.615a.75.75 0 00-.75-.75H11.5a.75.75 0 00-.75.75v.625zm6.75-3.63v-.625a.75.75 0 00-.75-.75H11.5a.75.75 0 00-.75.75v.625c0 .414.336.75.75.75h5.25a.75.75 0 00.75-.75zm-8.25 0v-.625a.75.75 0 00-.75-.75H3.25a.75.75 0 00-.75.75v.625c0 .414.336.75.75.75H8.5a.75.75 0 00.75-.75zM17.5 7.5v-.625a.75.75 0 00-.75-.75H11.5a.75.75 0 00-.75.75V7.5c0 .414.336.75.75.75h5.25a.75.75 0 00.75-.75zm-8.25 0v-.625a.75.75 0 00-.75-.75H3.25a.75.75 0 00-.75.75V7.5c0 .414.336.75.75.75H8.5a.75.75 0 00.75-.75z" clipRule="evenodd" />
                </svg>
                Tabela
              </button>
              <button
                onClick={() => setViewMode("calendar")}
                title="Vista calendário"
                className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                  viewMode === "calendar"
                    ? "bg-white text-stone-800 shadow-sm"
                    : "text-stone-500 hover:text-stone-700"
                }`}
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5.75 2a.75.75 0 01.75.75V4h7V2.75a.75.75 0 011.5 0V4h.25A2.75 2.75 0 0118 6.75v8.5A2.75 2.75 0 0115.25 18H4.75A2.75 2.75 0 012 15.25v-8.5A2.75 2.75 0 014.75 4H5V2.75A.75.75 0 015.75 2zm-1 5.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25v-6.5c0-.69-.56-1.25-1.25-1.25H4.75z" clipRule="evenodd" />
                </svg>
                Calendário
              </button>
            </div>

            <div className="h-6 w-px bg-stone-200" />

            <button
              onClick={() => setShowImport(true)}
              className="flex items-center gap-2 rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              Importar fatura
            </button>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 rounded-md bg-gradient-to-r from-[#ED5C32] to-[#EF8935] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
              </svg>
              Nova manual
            </button>
          </div>
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
            value={alerts ? fromCents(alerts.overdue.totalAmount) : fromCents(kpis.overdueAmountCents)}
            sub={`${alerts?.overdue.count ?? kpis.overdue} vencida${(alerts?.overdue.count ?? kpis.overdue) !== 1 ? "s" : ""}`}
            accentClass="text-red-600"
          />
          <KpiCard
            label="Pendentes"
            value={fromCents(kpis.pendingAmountCents)}
            sub={`${kpis.pending} pendente${kpis.pending !== 1 ? "s" : ""}`}
            accentClass="text-amber-600"
          />
        </div>

        {/* Alert strip */}
        {alerts && (alerts.pendingReviewCount > 0 || alerts.dueIn7Days.count > 0 || alerts.lowAiConfidenceCount > 0) && (
          <div className="flex flex-wrap gap-3">
            {alerts.pendingReviewCount > 0 && (
              <button
                onClick={() => setStatusFilter("pending_review")}
                className="flex items-center gap-2 rounded-lg border border-purple-200 bg-purple-50 px-3 py-2 text-xs font-medium text-purple-700 hover:bg-purple-100"
              >
                <span className="h-2 w-2 rounded-full bg-purple-500" />
                {alerts.pendingReviewCount} para revisão
              </button>
            )}
            {alerts.dueIn7Days.count > 0 && (
              <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
                <span className="h-2 w-2 rounded-full bg-amber-400" />
                {alerts.dueIn7Days.count} vencem em 7 dias ({fromCents(alerts.dueIn7Days.totalAmount)})
              </div>
            )}
            {alerts.lowAiConfidenceCount > 0 && (
              <div className="flex items-center gap-2 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-medium text-orange-700">
                <span className="h-2 w-2 rounded-full bg-orange-400" />
                {alerts.lowAiConfidenceCount} com baixa confiança IA
              </div>
            )}
          </div>
        )}

        {/* Table mode: filters + tabs + table */}
        {viewMode === "table" && <>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar fornecedor ou nº fatura…"
            className="rounded-md border border-stone-300 bg-white px-3 py-2 text-sm focus:outline-none focus:border-[#ED5C32] w-64"
          />
          {activeTab === "all" && (
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
          )}
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-xl border border-[#F5C992]/40 bg-white">
          {/* Tabs */}
          <div className="flex border-b border-[#F5C992]/40 px-2">
            {(
              [
                { key: "all", label: "Todas", badgeCls: "bg-stone-100 text-stone-500" },
                { key: "today", label: "Vencem hoje", badgeCls: tabCounts.today > 0 ? "bg-amber-100 text-amber-700" : "bg-stone-100 text-stone-400" },
                { key: "week", label: "Vencem em 7 dias", badgeCls: tabCounts.week > 0 ? "bg-orange-100 text-orange-700" : "bg-stone-100 text-stone-400" },
                { key: "overdue", label: "Vencidas", badgeCls: tabCounts.overdue > 0 ? "bg-red-100 text-red-700" : "bg-stone-100 text-stone-400" },
              ] as const
            ).map(({ key, label, badgeCls }) => (
              <button
                key={key}
                onClick={() => handleTabChange(key)}
                className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab === key
                    ? "border-[#ED5C32] text-[#ED5C32]"
                    : "border-transparent text-stone-500 hover:text-stone-700"
                }`}
              >
                {label}
                <span className={`rounded-full px-1.5 py-0.5 text-xs font-semibold tabular-nums ${badgeCls}`}>
                  {tabCounts[key]}
                </span>
              </button>
            ))}
          </div>

          {isLoading ? (
            <div className="py-16 text-center text-sm text-stone-400">
              A carregar…
            </div>
          ) : tabFiltered.length === 0 ? (
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
                    "CC Padrão",
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
                {tabFiltered.map((inv) => (
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
                      {(() => {
                        const sup = inv.supplierId ? supplierById.get(inv.supplierId) : null;
                        const cat = sup?.defaultCostCenterCategoryId
                          ? categoryById.get(sup.defaultCostCenterCategoryId)
                          : null;
                        if (!cat) return <span className="text-[10px] text-stone-300">—</span>;
                        return (
                          <span
                            title={cat.name}
                            className="inline-flex items-center rounded-md bg-stone-100 px-2 py-0.5 text-[10px] font-medium text-stone-600"
                          >
                            {cat.code}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => {
                            if (inv.status === "draft_ai" || inv.status === "pending_review") {
                              void handleRowReview(inv);
                            } else {
                              setDetail(inv);
                            }
                          }}
                          className="rounded-md px-2 py-1 text-xs font-medium text-[#ED5C32] hover:bg-orange-50"
                        >
                          {inv.status === "draft_ai" || inv.status === "pending_review" ? "Rever" : "Ver"}
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm(`Eliminar fatura ${inv.invoiceNumber}? Esta ação não pode ser revertida.`)) {
                              deleteMutation.mutate(inv.id);
                            }
                          }}
                          disabled={deleteMutation.isPending && deleteMutation.variables === inv.id}
                          className="rounded-md p-1 text-stone-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-40"
                          title="Eliminar fatura"
                        >
                          <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        </> /* end table mode */}

        {/* Calendar mode */}
        {viewMode === "calendar" && (
          <InvoiceCalendarView
            invoicesByDate={invoicesByDueDate}
            noDueDateInvoices={noDueDateInvoices}
            month={calendarMonth}
            onPrevMonth={() =>
              setCalendarMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))
            }
            onNextMonth={() =>
              setCalendarMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))
            }
            onToday={() =>
              setCalendarMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))
            }
            onInvoiceClick={(inv) => setDetail(inv)}
          />
        )}

        {/* Drawers */}
        {showImport && (
          <ImportInvoiceModal
            onClose={() => setShowImport(false)}
            onImported={(result) => {
              setShowImport(false);
              setImportResult(result);
            }}
          />
        )}

        {importResult && (
          <ReviewImportedInvoiceDrawer
            importResult={importResult}
            onClose={() => setImportResult(null)}
            onConfirmed={(inv) => {
              setImportResult(null);
              setDetail(inv);
            }}
          />
        )}

        {showCreate && (
          <CreateInvoiceDrawer
            open={showCreate}
            suppliers={suppliers}
            categories={categories}
            saving={createMutation.isPending}
            onClose={() => setShowCreate(false)}
            onSave={(payload) => createMutation.mutate(payload)}
          />
        )}

        {detail && (
          <InvoiceDetailDrawer
            invoice={detail}
            categories={categories}
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
