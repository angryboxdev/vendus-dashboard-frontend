import { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useInvoicesModule } from "../../invoices.module.tsx";
import {
  type InvoiceDTO,
  type InvoiceLineDTO,
  type InvoiceStatus,
  type InvoiceLineType,
  type ReconciliationStatus,
  type LineDetailMode,
  type PaymentMethod,
  type CreateInvoicePayload,
  type CreateInvoiceLinePayload,
  type InvoiceImportResultDTO,
  INVOICE_STATUS_LABELS,
  INVOICE_LINE_TYPE_LABELS,
  PAYMENT_METHOD_LABELS,
} from "../../domain/entities/invoice.ts";
import { useBankAccountsModule } from "../../../bank-accounts/bank-accounts.module.tsx";
import type { BankDTO, AccountPreviewDTO } from "../../../bank-accounts/domain/entities/bank-account.ts";
import { ImportInvoiceModal } from "./ImportInvoiceModal.tsx";
import { ReviewImportedInvoiceDrawer } from "./ReviewImportedInvoiceDrawer.tsx";
import { useFinancialBaseModule } from "../../../financial-base/financial-base.module.tsx";
import type { CostCenterGroup, CostCenterCategory, ChannelDTO } from "../../../financial-base/domain/entities/cost-center.ts";
import { FINANCIAL_TYPE_LABELS, FINANCIAL_TYPE_COLORS } from "../../../financial-base/domain/entities/cost-center.ts";
import type { FinancialType } from "../../../financial-base/domain/entities/cost-center.ts";
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

function MobileStatusDot({ status }: { status: InvoiceStatus }) {
  return <span className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${STATUS_DOT[status]}`} />;
}

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

// ── ReconciliationBadge ────────────────────────────────────────────────────────

const RECON_CONFIG: Record<ReconciliationStatus, { label: string; cls: string }> = {
  none: { label: "", cls: "" },
  pending_reconciliation: { label: "Ag. conciliação", cls: "bg-violet-50 text-violet-700" },
  reconciled: { label: "Conciliada", cls: "bg-teal-50 text-teal-700" },
};

function ReconciliationBadge({ status }: { status: ReconciliationStatus }) {
  if (status === "none") return null;
  const { label, cls } = RECON_CONFIG[status];
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}

// ── MarkPaidModal ─────────────────────────────────────────────────────────────

function bankAccountLabel(bank: BankDTO, acc: AccountPreviewDTO): string {
  const name = acc.nickname ?? acc.label;
  return acc.lastFourDigits ? `${name} (${bank.name}) •••• ${acc.lastFourDigits}` : `${name} (${bank.name})`;
}

function MarkPaidModal({
  invoice,
  onConfirm,
  onClose,
  saving,
}: {
  invoice: InvoiceDTO;
  onConfirm: (paidAt: string, bankAccountId: string, paymentMethod: PaymentMethod, paymentNotes?: string) => void;
  onClose: () => void;
  saving: boolean;
}) {
  const { api: bankApi } = useBankAccountsModule();
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const [paidAt, setPaidAt] = useState(todayStr);
  const [bankAccountId, setBankAccountId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | "">("");
  const [paymentNotes, setPaymentNotes] = useState("");

  const { data: banks = [] } = useQuery({
    queryKey: ["banks-for-payment"],
    queryFn: () => bankApi.listBanks(),
  });

  const allAccounts = useMemo(() => {
    const result: { id: string; label: string }[] = [];
    for (const bank of banks) {
      for (const acc of bank.accountPreviews) {
        if (acc.isActive) result.push({ id: acc.id, label: bankAccountLabel(bank, acc) });
      }
    }
    return result;
  }, [banks]);

  const isValid = !!paidAt && !!bankAccountId && !!paymentMethod;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-xl bg-white shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4">
          <h3 className="text-base font-bold text-stone-900">Confirmar pagamento</h3>
          <button onClick={onClose} className="rounded-md p-1 text-stone-400 hover:bg-stone-100">
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 pb-2 space-y-4">
          {/* Info banner */}
          <div className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2.5 text-xs text-violet-700">
            <p className="font-medium">Ao confirmar, esta fatura ficará com o estado</p>
            <p className="mt-0.5 font-bold">Aguardando conciliação</p>
            <p className="mt-0.5 text-violet-600">e será conciliada automaticamente quando o movimento bancário for identificado.</p>
          </div>

          {/* Data de pagamento */}
          <div>
            <label className="mb-1 block text-xs font-medium text-stone-600">
              Data de pagamento <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={paidAt}
              onChange={(e) => setPaidAt(e.target.value)}
              className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm focus:outline-none focus:border-[#ED5C32]"
            />
          </div>

          {/* Conta bancária */}
          <div>
            <label className="mb-1 block text-xs font-medium text-stone-600">
              Conta bancária <span className="text-red-500">*</span>
            </label>
            <select
              value={bankAccountId}
              onChange={(e) => setBankAccountId(e.target.value)}
              className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm focus:outline-none focus:border-[#ED5C32]"
            >
              <option value="">— selecionar conta —</option>
              {allAccounts.map((acc) => (
                <option key={acc.id} value={acc.id}>{acc.label}</option>
              ))}
            </select>
          </div>

          {/* Método de pagamento */}
          <div>
            <label className="mb-1 block text-xs font-medium text-stone-600">
              Método <span className="text-red-500">*</span>
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
              className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm focus:outline-none focus:border-[#ED5C32]"
            >
              <option value="">— selecionar método —</option>
              {(Object.entries(PAYMENT_METHOD_LABELS) as [PaymentMethod, string][]).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          {/* Observação */}
          <div>
            <label className="mb-1 block text-xs font-medium text-stone-600">Observação</label>
            <textarea
              value={paymentNotes}
              onChange={(e) => setPaymentNotes(e.target.value.slice(0, 200))}
              rows={3}
              placeholder="Pagamento via homebanking…"
              className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm focus:outline-none focus:border-[#ED5C32] resize-none"
            />
            <p className="mt-0.5 text-right text-xs text-stone-400">{paymentNotes.length}/200</p>
          </div>

          {/* Resumo */}
          <div className="rounded-lg border border-stone-100 bg-stone-50 p-3 text-xs">
            <p className="mb-2 font-semibold text-stone-600">Resumo do pagamento</p>
            <dl className="divide-y divide-stone-100">
              {[
                { label: "Fornecedor", value: invoice.supplierName },
                { label: "Nº de fatura", value: invoice.invoiceNumber },
                { label: "Vencimento", value: formatDate(invoice.dueDate) },
                { label: "Valor total", value: fromCents(invoice.totalWithVat) },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between py-1.5">
                  <dt className="text-stone-400">{label}</dt>
                  <dd className="font-semibold text-stone-700">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pt-3 pb-5 space-y-3 border-t border-stone-100 mt-2">
          <p className="flex items-start gap-1.5 text-xs text-stone-400">
            <svg className="mt-0.5 h-3.5 w-3.5 shrink-0 text-stone-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" />
            </svg>
            O pagamento será registado no sistema e aguardará conciliação bancária.
          </p>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 rounded-md border border-stone-300 px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-50"
            >
              Cancelar
            </button>
            <button
              onClick={() => onConfirm(paidAt, bankAccountId, paymentMethod as PaymentMethod, paymentNotes || undefined)}
              disabled={saving || !isValid}
              className="flex-1 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {saving ? "A registar…" : "Confirmar pagamento"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── DeleteConfirmModal ────────────────────────────────────────────────────────

function DeleteConfirmModal({
  invoice,
  onConfirm,
  onClose,
  deleting,
}: {
  invoice: InvoiceDTO;
  onConfirm: () => void;
  onClose: () => void;
  deleting: boolean;
}) {
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl">
        <h3 className="text-base font-bold text-stone-900">Eliminar fatura</h3>
        <p className="mt-2 text-sm text-stone-600">
          Tens a certeza que queres eliminar{" "}
          <span className="font-semibold">{invoice.invoiceNumber}</span> de{" "}
          <span className="font-semibold">{invoice.supplierName}</span>? Esta ação é irreversível.
        </p>
        <div className="mt-5 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-md border border-stone-300 px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-50"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="flex-1 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {deleting ? "A eliminar…" : "Eliminar"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}


// ── Line Classify Panel ────────────────────────────────────────────────────────

interface ClassifyPanelProps {
  line: InvoiceLineDTO;
  invoiceId: string;
  categories: CostCenterCategory[];
  channels: ChannelDTO[];
  onDone: (updated: InvoiceLineDTO) => void;
}

function ClassifyPanel({
  line,
  invoiceId,
  categories,
  channels,
  onDone,
}: ClassifyPanelProps) {
  const { api } = useInvoicesModule();
  const [type, setType] = useState<InvoiceLineType>(line.type);
  const [catId, setCatId] = useState(line.costCenterCategoryId ?? "");
  const [channelId, setChannelId] = useState(line.channelId ?? "");
  const [saveRule, setSaveRule] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedCategory = categories.find((c) => c.id === catId);
  const channelRequired = selectedCategory?.requiresChannel ?? false;

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const updated = await api.classifyLine(invoiceId, line.id, {
        classify: {
          type,
          costCenterCategoryId: catId || null,
          channelId: channelId || null,
        },
        saveAsRule: saveRule,
      });
      onDone(updated);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao classificar";
      setError(msg.includes("Canal") ? "Canal obrigatório para esta subcategoria." : msg);
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
            onChange={(e) => { setCatId(e.target.value); setChannelId(""); }}
            className="w-full rounded-md border border-stone-300 bg-white px-2 py-1.5 text-xs focus:outline-none focus:border-[#ED5C32]"
          >
            <option value="">— nenhuma —</option>
            {categories.filter((c) => c.isActive).map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} — {c.name}
              </option>
            ))}
          </select>
          {selectedCategory && (
            <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs ${FINANCIAL_TYPE_COLORS[selectedCategory.financialType as FinancialType]}`}>
              {FINANCIAL_TYPE_LABELS[selectedCategory.financialType as FinancialType]}
            </span>
          )}
        </div>
      </div>
      {(channelRequired || !!channelId) && (
        <div>
          <label className="mb-1 block text-xs font-medium text-stone-500">
            Canal {channelRequired && <span className="text-red-500">*</span>}
          </label>
          <select
            value={channelId}
            onChange={(e) => setChannelId(e.target.value)}
            className="w-full rounded-md border border-stone-300 bg-white px-2 py-1.5 text-xs focus:outline-none focus:border-[#ED5C32]"
          >
            <option value="">— nenhum —</option>
            {channels.filter((ch) => ch.isActive).map((ch) => (
              <option key={ch.id} value={ch.id}>
                {ch.name}
              </option>
            ))}
          </select>
        </div>
      )}
      <label className="flex items-center gap-2 text-xs text-stone-600">
        <input
          type="checkbox"
          checked={saveRule}
          onChange={(e) => setSaveRule(e.target.checked)}
          className="rounded"
        />
        Guardar como regra para este fornecedor
      </label>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button
        onClick={() => void handleSave()}
        disabled={saving || (channelRequired && !channelId)}
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
      {/* CC subcategory */}
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

// ── Edit Line Form ─────────────────────────────────────────────────────────────

function EditLineForm({
  line,
  invoiceId,
  onDone,
  onCancel,
}: {
  line: InvoiceLineDTO;
  invoiceId: string;
  onDone: (updated: InvoiceLineDTO) => void;
  onCancel: () => void;
}) {
  const { api } = useInvoicesModule();
  const [description, setDescription] = useState(line.description);
  const [quantity, setQuantity]       = useState(String(line.quantity));
  const [unit, setUnit]               = useState(line.unit ?? "");
  const [unitCost, setUnitCost]       = useState(String(line.unitCostWithoutVat / 100));
  const [vatRate, setVatRate]         = useState(String(line.vatRate));
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState<string | null>(null);

  const subtotal   = parseFloat(quantity || "0") * parseFloat(unitCost || "0");
  const vatAmount  = Math.round(subtotal * (parseFloat(vatRate) / 100) * 100);
  const totalCents = Math.round(subtotal * 100) + vatAmount;

  async function handleSave() {
    if (!description || !unitCost) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await api.updateLine(invoiceId, line.id, {
        description,
        quantity: parseFloat(quantity),
        unit: unit || null,
        unitCostWithoutVat: Math.round(parseFloat(unitCost) * 100),
        vatRate: parseFloat(vatRate),
        vatAmount,
        totalWithVat: totalCents,
      });
      onDone(updated);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-[#F5C992]/60 bg-[#FDF8F5] p-3 text-sm">
      <p className="text-xs font-semibold text-stone-600">Editar linha</p>
      <input
        type="text"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Descrição *"
        className="w-full rounded-md border border-stone-300 bg-white px-2 py-1.5 text-xs focus:outline-none focus:border-[#ED5C32]"
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          type="number" min="0.001" step="any" value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          placeholder="Qtd *"
          className="rounded-md border border-stone-300 bg-white px-2 py-1.5 text-xs focus:outline-none focus:border-[#ED5C32]"
        />
        <input
          type="text" value={unit}
          onChange={(e) => setUnit(e.target.value)}
          placeholder="Unidade (ex: kg)"
          className="rounded-md border border-stone-300 bg-white px-2 py-1.5 text-xs focus:outline-none focus:border-[#ED5C32]"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input
          type="number" min="0" step="any" value={unitCost}
          onChange={(e) => setUnitCost(e.target.value)}
          placeholder="Preço unit. s/ IVA (€) *"
          className="rounded-md border border-stone-300 bg-white px-2 py-1.5 text-xs focus:outline-none focus:border-[#ED5C32]"
        />
        <select
          value={vatRate}
          onChange={(e) => setVatRate(e.target.value)}
          className="rounded-md border border-stone-300 bg-white px-2 py-1.5 text-xs focus:outline-none focus:border-[#ED5C32]"
        >
          {["0", "6", "13", "23"].map((r) => (
            <option key={r} value={r}>{r}% IVA</option>
          ))}
        </select>
      </div>
      {unitCost && (
        <p className="text-xs text-stone-400">
          Total: {fromCents(totalCents)}
        </p>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="flex-1 rounded-md border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50"
        >
          Cancelar
        </button>
        <button
          onClick={() => void handleSave()}
          disabled={saving || !description || !unitCost}
          className="flex-1 rounded-md bg-gradient-to-r from-[#ED5C32] to-[#EF8935] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "A guardar…" : "Guardar"}
        </button>
      </div>
    </div>
  );
}

// ── Invoice Detail Drawer ──────────────────────────────────────────────────────

interface DetailDrawerProps {
  invoice: InvoiceDTO | null;
  categories: CostCenterCategory[];
  channels: ChannelDTO[];
  groups: CostCenterGroup[];
  linkedPayable?: PayableEntryDTO | null;
  onClose: () => void;
  onOpenMarkPaid: (inv: InvoiceDTO) => void;
  onInvoiceUpdated?: (inv: InvoiceDTO) => void;
}

function InvoiceDetailDrawer({
  invoice,
  categories,
  channels,
  groups,
  linkedPayable,
  onClose,
  onOpenMarkPaid,
  onInvoiceUpdated,
}: DetailDrawerProps) {
  const { api } = useInvoicesModule();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"details" | "classificacao" | "lines">("details");
  const [lines, setLines] = useState<InvoiceLineDTO[]>([]);
  const [loadingLines, setLoadingLines] = useState(false);
  const [showAddLine, setShowAddLine] = useState(false);
  const [reconcilingState, setReconcilingState] = useState<"idle" | "loading">("idle");
  const [settingLineMode, setSettingLineMode] = useState<"idle" | "loading">("idle");
  const [showPdf, setShowPdf] = useState(false);
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [editingClassification, setEditingClassification] = useState(false);
  const [savingClassification, setSavingClassification] = useState(false);
  const [classifyGroupId, setClassifyGroupId] = useState("");
  const [classifyCategoryId, setClassifyCategoryId] = useState("");

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

  function handleTabChange(t: "details" | "classificacao" | "lines") {
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

  async function handleMarkReconciled() {
    if (!invoice) return;
    setReconcilingState("loading");
    try {
      const updated = await api.markInvoiceReconciled(invoice.id);
      void qc.invalidateQueries({ queryKey: ["invoices"] });
      void qc.invalidateQueries({ queryKey: ["invoice-alerts"] });
      if (onInvoiceUpdated) onInvoiceUpdated(updated);
    } finally {
      setReconcilingState("idle");
    }
  }

  async function handleToggleLineDetailMode(mode: LineDetailMode) {
    if (!invoice) return;
    setSettingLineMode("loading");
    try {
      const updated = await api.setLineDetailMode(invoice.id, mode);
      void qc.invalidateQueries({ queryKey: ["invoices"] });
      if (onInvoiceUpdated) onInvoiceUpdated(updated);
    } finally {
      setSettingLineMode("idle");
    }
  }

  async function handleSaveClassification() {
    if (!invoice) return;
    setSavingClassification(true);
    try {
      const cat = categories.find((c) => c.id === classifyCategoryId);
      const updated = await api.updateInvoice(invoice.id, {
        costCenterGroupId: classifyGroupId || null,
        costCenterCategoryId: classifyCategoryId || null,
        financialType: cat?.financialType ?? null,
        affectsDre: cat?.affectsDre ?? false,
        affectsCashflow: cat?.affectsCashflow ?? false,
        affectsProfitability: cat?.affectsProfitability ?? false,
      });
      void qc.invalidateQueries({ queryKey: ["invoices"] });
      if (onInvoiceUpdated) onInvoiceUpdated(updated);
      setEditingClassification(false);
    } finally {
      setSavingClassification(false);
    }
  }

  if (!invoice) return null;

  const ccMap = new Map(categories.map((c) => [c.id, c]));
  const groupMap = new Map(groups.map((g) => [g.id, g]));

  const classificationCategory = invoice.costCenterCategoryId ? ccMap.get(invoice.costCenterCategoryId) : null;
  const classificationGroup = invoice.costCenterGroupId ? groupMap.get(invoice.costCenterGroupId) : null;

  const isClassified = !!(invoice.costCenterGroupId || invoice.costCenterCategoryId || invoice.financialType);

  return createPortal(
    <div className="fixed inset-0 z-50 flex" aria-modal="true">
      <div className="flex-1 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <aside className={`flex h-full w-full bg-white shadow-2xl transition-[max-width] duration-300 ${showPdf && invoice.attachmentUrl ? "max-w-[1280px]" : "max-w-2xl"}`}>
        {/* Left column */}
        <div className="flex flex-1 flex-col overflow-hidden">
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
          <div className="flex items-center gap-2">
            {invoice.attachmentUrl && (
              <button
                onClick={() => setShowPdf((v) => !v)}
                className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${showPdf ? "border-stone-300 bg-stone-100 text-stone-700" : "border-stone-300 bg-white text-stone-600 hover:bg-stone-50"}`}
              >
                {showPdf ? "Fechar doc." : "Ver documento"}
              </button>
            )}
            <button
              onClick={onClose}
              className="rounded-md p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-600"
            >
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
              </svg>
            </button>
          </div>
        </div>

            {/* Tabs */}
            <div className="flex border-b border-[#F5C992]/40 px-6">
              {([
                { key: "details", label: "Detalhes" },
                { key: "classificacao", label: "Classificação" },
                { key: "lines", label: "Linhas" },
              ] as const).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => handleTabChange(key)}
                  className={`-mb-px border-b-2 px-4 py-3 text-sm font-medium ${
                    tab === key
                      ? "border-[#ED5C32] text-[#ED5C32]"
                      : "border-transparent text-stone-500 hover:text-stone-700"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
          {tab === "details" && (
            <div className="space-y-4">
              {/* Status + reconciliation + actions */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <StatusBadge status={invoice.status} />
                  <ReconciliationBadge status={invoice.reconciliationStatus} />
                </div>
                <div className="flex items-center gap-2">
                  {(invoice.status === "pending" || invoice.status === "overdue") && (
                    <button
                      onClick={() => onOpenMarkPaid(invoice)}
                      className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
                    >
                      Marcar como paga
                    </button>
                  )}
                  {invoice.reconciliationStatus === "pending_reconciliation" && (
                    <button
                      onClick={() => void handleMarkReconciled()}
                      disabled={reconcilingState === "loading"}
                      className="rounded-md bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-700 disabled:opacity-50"
                    >
                      {reconcilingState === "loading" ? "A conciliar…" : "Conciliar"}
                    </button>
                  )}
                </div>
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
                  ...(!invoice.isDirectDebit ? [{
                    label: "Data de vencimento",
                    value: formatDate(invoice.dueDate),
                  }] : []),
                  ...(invoice.isDirectDebit ? [{
                    label: "Débito direto em",
                    value: formatDate(invoice.directDebitDate),
                  }] : []),
                  {
                    label: "Data de pagamento",
                    value: formatDate(invoice.paidAt),
                  },
                  ...(invoice.paidAt && invoice.reconciliationStatus !== "none" ? [{
                    label: "Conciliação bancária",
                    value: invoice.reconciliationStatus === "reconciled" ? "Conciliada" : "Aguardando confirmação no extrato",
                  }] : []),
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

          {tab === "classificacao" && (
            <div className="space-y-4">
              {/* Badge + edit toggle */}
              <div className="flex items-center justify-between">
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${isClassified ? "bg-teal-50 text-teal-700" : "bg-stone-100 text-stone-500"}`}>
                  {isClassified ? "Pré-classificada" : "Não classificada"}
                </span>
                {!editingClassification && (
                  <button
                    onClick={() => {
                      setClassifyGroupId(invoice.costCenterGroupId ?? "");
                      setClassifyCategoryId(invoice.costCenterCategoryId ?? "");
                      setEditingClassification(true);
                    }}
                    className="text-xs font-medium text-[#ED5C32] hover:underline"
                  >
                    Editar
                  </button>
                )}
              </div>

              {editingClassification ? (
                /* Edit form */
                <div className="space-y-3 rounded-lg border border-[#F5C992]/60 bg-[#FDF8F5] p-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-stone-600">Centro de custo</label>
                    <select
                      value={classifyGroupId}
                      onChange={(e) => { setClassifyGroupId(e.target.value); setClassifyCategoryId(""); }}
                      className="w-full rounded-md border border-stone-300 bg-white px-2 py-1.5 text-xs focus:outline-none focus:border-[#ED5C32]"
                    >
                      <option value="">— nenhum —</option>
                      {groups.map((g) => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-stone-600">Subcategoria</label>
                    <select
                      value={classifyCategoryId}
                      onChange={(e) => setClassifyCategoryId(e.target.value)}
                      className="w-full rounded-md border border-stone-300 bg-white px-2 py-1.5 text-xs focus:outline-none focus:border-[#ED5C32]"
                    >
                      <option value="">— nenhuma —</option>
                      {categories
                        .filter((c) => c.isActive && (!classifyGroupId || c.groupId === classifyGroupId))
                        .map((c) => (
                          <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
                        ))}
                    </select>
                    {classifyCategoryId && (() => {
                      const cat = categories.find((c) => c.id === classifyCategoryId);
                      return cat ? (
                        <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs ${FINANCIAL_TYPE_COLORS[cat.financialType as FinancialType]}`}>
                          {FINANCIAL_TYPE_LABELS[cat.financialType as FinancialType]}
                        </span>
                      ) : null;
                    })()}
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => setEditingClassification(false)}
                      className="flex-1 rounded-md border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={() => void handleSaveClassification()}
                      disabled={savingClassification}
                      className="flex-1 rounded-md bg-gradient-to-r from-[#ED5C32] to-[#EF8935] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
                    >
                      {savingClassification ? "A guardar…" : "Guardar"}
                    </button>
                  </div>
                </div>
              ) : (
                /* Read-only view */
                <dl className="divide-y divide-stone-100">
                  <div className="flex justify-between py-2">
                    <dt className="text-xs text-stone-400">Centro de custo</dt>
                    <dd className="text-sm font-medium text-stone-700">{classificationGroup?.name ?? "—"}</dd>
                  </div>
                  <div className="flex justify-between py-2">
                    <dt className="text-xs text-stone-400">Subcategoria</dt>
                    <dd className="text-sm font-medium text-stone-700">
                      {classificationCategory ? `${classificationCategory.code} — ${classificationCategory.name}` : "—"}
                    </dd>
                  </div>
                  <div className="flex justify-between py-2">
                    <dt className="text-xs text-stone-400">Tipo financeiro</dt>
                    <dd className="text-sm font-medium text-stone-700">
                      {invoice.financialType
                        ? (FINANCIAL_TYPE_LABELS[invoice.financialType as FinancialType] ?? invoice.financialType)
                        : "—"}
                    </dd>
                  </div>
                </dl>
              )}

              {/* Financial impact — only when classified */}
              {isClassified && !editingClassification && (
                <div>
                  <p className="mb-2 text-xs font-semibold text-stone-500 uppercase tracking-wide">Impacto financeiro</p>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: "DRE", active: invoice.affectsDre },
                      { label: "Fluxo de Caixa", active: invoice.affectsCashflow },
                      { label: "Rentabilidade", active: invoice.affectsProfitability },
                    ].map(({ label, active }) => (
                      <div
                        key={label}
                        className={`rounded-lg border p-2.5 text-center text-xs font-medium ${active ? "border-teal-200 bg-teal-50 text-teal-700" : "border-stone-100 bg-stone-50 text-stone-400"}`}
                      >
                        <p>{label}</p>
                        <p className="mt-0.5 font-bold">{active ? "Sim" : "Não"}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === "lines" && (
            <div className="space-y-3">
              {/* Line detail mode toggle */}
              <div className="flex items-center justify-between rounded-lg border border-stone-100 bg-stone-50 px-3 py-2">
                <div>
                  <p className="text-xs font-medium text-stone-700">Modo de linhas</p>
                  <p className="text-xs text-stone-400">{invoice.lineDetailMode === "detailed" ? "Detalhado — linhas editáveis" : "Simples — linha única automática"}</p>
                </div>
                <button
                  onClick={() => void handleToggleLineDetailMode(invoice.lineDetailMode === "detailed" ? "simple" : "detailed")}
                  disabled={settingLineMode === "loading"}
                  className="rounded-md border border-stone-300 bg-white px-2.5 py-1 text-xs font-medium text-stone-600 hover:bg-stone-100 disabled:opacity-50"
                >
                  {settingLineMode === "loading" ? "…" : invoice.lineDetailMode === "detailed" ? "Simplificar" : "Detalhar"}
                </button>
              </div>

              {/* Simple mode warning */}
              {invoice.lineDetailMode === "simple" && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
                  <p className="text-xs font-medium text-amber-700">Modo simples activo</p>
                  <p className="mt-0.5 text-xs text-amber-600">Altera o modo de linhas acima para adicionar/editar linhas individualmente.</p>
                </div>
              )}

              {/* Lines total vs invoice total */}
              {lines.length > 0 && (() => {
                const linesTotal = lines.reduce((s, l) => s + l.totalWithVat, 0);
                const diff = linesTotal - invoice.totalWithVat;
                const ok = Math.abs(diff) <= 1;
                return (
                  <div className={`flex items-center justify-between rounded-lg border px-3 py-2 text-xs ${ok ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}>
                    <span>Soma das linhas: <span className="font-semibold">{fromCents(linesTotal)}</span></span>
                    <span>Fatura: <span className="font-semibold">{fromCents(invoice.totalWithVat)}</span></span>
                    {!ok && <span className="font-semibold">Δ {fromCents(Math.abs(diff))}</span>}
                    {ok && <span>✓</span>}
                  </div>
                );
              })()}

              {/* Add line button */}
              {!showAddLine && invoice.lineDetailMode === "detailed" && (
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
                  const isEditingThisLine = editingLineId === line.id;
                  return (
                    <div
                      key={line.id}
                      className="space-y-2 rounded-lg border border-stone-200 bg-white p-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-stone-800">
                          {line.description}
                        </p>
                        <div className="flex shrink-0 items-center gap-1.5">
                          {invoice.lineDetailMode === "detailed" && !isEditingThisLine && (
                            <button
                              onClick={() => setEditingLineId(line.id)}
                              className="text-xs font-medium text-[#ED5C32] hover:underline"
                            >
                              Editar
                            </button>
                          )}
                          <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600">
                            {INVOICE_LINE_TYPE_LABELS[line.type]}
                          </span>
                        </div>
                      </div>
                      {!isEditingThisLine && (
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
                        </div>
                      )}
                      {isEditingThisLine ? (
                        <EditLineForm
                          line={line}
                          invoiceId={invoice.id}
                          onDone={(updated) => { handleLineUpdated(updated); setEditingLineId(null); }}
                          onCancel={() => setEditingLineId(null)}
                        />
                      ) : (
                        <ClassifyPanel
                          line={line}
                          invoiceId={invoice.id}
                          categories={categories}
                          channels={channels}
                          onDone={handleLineUpdated}
                        />
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
          </div>
        </div>{/* end left column */}

        {/* Inline PDF panel — right side, full height from header */}
        {showPdf && invoice.attachmentUrl && (
          <div className="flex w-[580px] shrink-0 flex-col border-l border-[#F5C992]/40">
            <div className="flex items-center justify-between border-b border-[#F5C992]/40 px-4 py-2">
              <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Documento original</p>
              <a
                href={invoice.attachmentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-medium text-[#ED5C32] hover:underline"
              >
                Abrir em nova janela ↗
              </a>
            </div>
            <iframe
              src={invoice.attachmentUrl}
              title="Documento original"
              className="w-full flex-1"
              style={{ border: "none" }}
            />
          </div>
        )}
      </aside>
    </div>,
    document.body
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
}

function emptyLineBuilder(): LineBuilder {
  return { description: "", type: "other", quantity: "1", unit: "", unitCost: "", vatRate: "23", catId: "" };
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

  return createPortal(
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
    </div>,
    document.body
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
  const [directDebitFilter, setDirectDebitFilter] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "pending" | "overdue">("all");
  const [quickFilter, setQuickFilter] = useState<"today" | "week" | "reconciliation" | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importResult, setImportResult] = useState<InvoiceImportResultDTO | null>(null);
  const [detail, setDetail] = useState<InvoiceDTO | null>(null);
  const [markingPaidId, setMarkingPaidId] = useState<string | null>(null);
  const [markPaidInvoice, setMarkPaidInvoice] = useState<InvoiceDTO | null>(null);
  const [reconcilingId, setReconcilingId] = useState<string | null>(null);
  const [deleteConfirmInvoice, setDeleteConfirmInvoice] = useState<InvoiceDTO | null>(null);

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

  const { data: groups = [] } = useQuery({
    queryKey: ["cost-center-groups"],
    queryFn: () => fbModule.api.listCostCenterGroups(),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["cost-center-categories"],
    queryFn: () => fbModule.api.listCostCenterCategories(),
  });

  const { data: channels = [] } = useQuery({
    queryKey: ["channels"],
    queryFn: () => fbModule.api.listChannels(),
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
      setDeleteConfirmInvoice(null);
    },
  });

  async function handleMarkPaid(id: string, paidAt?: string, bankAccountId?: string, paymentMethod?: string, paymentNotes?: string) {
    setMarkingPaidId(id);
    try {
      const updated = await api.markInvoicePaid(id, paidAt, bankAccountId ?? null, paymentMethod ?? null, paymentNotes ?? null);
      void qc.invalidateQueries({ queryKey: ["invoices"] });
      void qc.invalidateQueries({ queryKey: ["invoice-alerts"] });
      void qc.invalidateQueries({ queryKey: ["payable-entries"] });
      if (detail?.id === id) setDetail(updated);
      setMarkPaidInvoice(null);
    } finally {
      setMarkingPaidId(null);
    }
  }

  async function handleMarkReconciled(id: string) {
    setReconcilingId(id);
    try {
      const updated = await api.markInvoiceReconciled(id);
      void qc.invalidateQueries({ queryKey: ["invoices"] });
      void qc.invalidateQueries({ queryKey: ["invoice-alerts"] });
      if (detail?.id === id) setDetail(updated);
    } finally {
      setReconcilingId(null);
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
    let result = invoices;
    if (directDebitFilter) result = result.filter((inv) => inv.isDirectDebit);
    if (!search) return result;
    const q = search.toLowerCase();
    return result.filter(
      (inv) =>
        inv.supplierName.toLowerCase().includes(q) ||
        inv.invoiceNumber.toLowerCase().includes(q),
    );
  }, [invoices, search, directDebitFilter]);

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
      pending: invoices.filter((i) => i.status === "pending").length,
      overdue: invoices.filter((i) => i.status === "overdue").length,
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
      reconciliation: invoices.filter((i) => i.reconciliationStatus === "pending_reconciliation").length,
    };
  }, [invoices]);

  const tabFiltered = useMemo(() => {
    const today = getTodayStr();
    const in7 = getIn7DaysStr();
    let result = filtered;
    switch (activeTab) {
      case "pending":
        result = result.filter((i) => i.status === "pending");
        break;
      case "overdue":
        result = result.filter((i) => i.status === "overdue");
        break;
    }
    if (quickFilter === "today") {
      result = result.filter((i) => i.dueDate === today && !["paid", "cancelled"].includes(i.status));
    } else if (quickFilter === "week") {
      result = result.filter((i) => i.dueDate != null && i.dueDate > today && i.dueDate <= in7 && !["paid", "cancelled"].includes(i.status));
    } else if (quickFilter === "reconciliation") {
      result = result.filter((i) => i.reconciliationStatus === "pending_reconciliation");
    }
    return result;
  }, [filtered, activeTab, quickFilter]);

  function handleTabChange(tab: "all" | "pending" | "overdue") {
    setActiveTab(tab);
    setQuickFilter(null);
    if (tab !== "all") setStatusFilter("");
  }

  function handleQuickFilter(f: "today" | "week" | "reconciliation") {
    setQuickFilter((prev) => (prev === f ? null : f));
  }

  // KPIs
  const kpis = useMemo(() => {
    const today = getTodayStr();
    const overdueList = invoices.filter((i) => i.status === "overdue");
    const pendingList = invoices.filter((i) => i.status === "pending");
    const todayList = invoices.filter((i) => i.dueDate === today && !["paid", "cancelled"].includes(i.status));
    const reconList = invoices.filter((i) => i.reconciliationStatus === "pending_reconciliation");
    return {
      pending: pendingList.length,
      pendingAmount: pendingList.reduce((s, i) => s + i.totalWithVat, 0),
      overdue: overdueList.length,
      overdueAmount: overdueList.reduce((s, i) => s + i.totalWithVat, 0),
      today: todayList.length,
      todayAmount: todayList.reduce((s, i) => s + i.totalWithVat, 0),
      reconciliation: reconList.length,
      reconciliationAmount: reconList.reduce((s, i) => s + i.totalWithVat, 0),
    };
  }, [invoices]);

  return (
    <div className="min-h-screen bg-[#FAF6F3]">
      {/* Header */}
      <div className="border-b border-[#F5C992]/40 bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-stone-900">Faturas</h1>
            <p className="mt-0.5 hidden sm:block text-sm text-stone-500">
              Gestão de faturas de fornecedores
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* View mode toggle */}
            <div className="flex rounded-md border border-stone-200 bg-stone-50 p-0.5">
              <button
                onClick={() => setViewMode("table")}
                title="Vista tabela"
                className={`flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium transition-colors sm:px-3 ${
                  viewMode === "table"
                    ? "bg-white text-stone-800 shadow-sm"
                    : "text-stone-500 hover:text-stone-700"
                }`}
              >
                <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M.99 5.24A2.25 2.25 0 013.25 3h13.5A2.25 2.25 0 0119 5.25l.01 9.5A2.25 2.25 0 0116.76 17H3.26A2.272 2.272 0 011 14.75l-.01-9.51zm8.26 9.52v-.625a.75.75 0 00-.75-.75H3.25a.75.75 0 00-.75.75v.615c0 .414.336.75.75.75h5.373a.75.75 0 00.627-.74zm1.5 0a.75.75 0 00.627.74h5.373a.75.75 0 00.75-.75v-.615a.75.75 0 00-.75-.75H11.5a.75.75 0 00-.75.75v.625zm6.75-3.63v-.625a.75.75 0 00-.75-.75H11.5a.75.75 0 00-.75.75v.625c0 .414.336.75.75.75h5.25a.75.75 0 00.75-.75zm-8.25 0v-.625a.75.75 0 00-.75-.75H3.25a.75.75 0 00-.75.75v.625c0 .414.336.75.75.75H8.5a.75.75 0 00.75-.75zM17.5 7.5v-.625a.75.75 0 00-.75-.75H11.5a.75.75 0 00-.75.75V7.5c0 .414.336.75.75.75h5.25a.75.75 0 00.75-.75zm-8.25 0v-.625a.75.75 0 00-.75-.75H3.25a.75.75 0 00-.75.75V7.5c0 .414.336.75.75.75H8.5a.75.75 0 00.75-.75z" clipRule="evenodd" />
                </svg>
                <span className="hidden sm:inline">Tabela</span>
              </button>
              <button
                onClick={() => setViewMode("calendar")}
                title="Vista calendário"
                className={`flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium transition-colors sm:px-3 ${
                  viewMode === "calendar"
                    ? "bg-white text-stone-800 shadow-sm"
                    : "text-stone-500 hover:text-stone-700"
                }`}
              >
                <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5.75 2a.75.75 0 01.75.75V4h7V2.75a.75.75 0 011.5 0V4h.25A2.75 2.75 0 0118 6.75v8.5A2.75 2.75 0 0115.25 18H4.75A2.75 2.75 0 012 15.25v-8.5A2.75 2.75 0 014.75 4H5V2.75A.75.75 0 015.75 2zm-1 5.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25v-6.5c0-.69-.56-1.25-1.25-1.25H4.75z" clipRule="evenodd" />
                </svg>
                <span className="hidden sm:inline">Calendário</span>
              </button>
            </div>

            <div className="h-6 w-px bg-stone-200" />

            <button
              onClick={() => setShowImport(true)}
              title="Importar fatura"
              className="flex items-center gap-2 rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 sm:px-4"
            >
              <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              <span className="hidden sm:inline">Importar fatura</span>
            </button>
            <button
              onClick={() => setShowCreate(true)}
              title="Nova fatura manual"
              className="flex items-center gap-2 rounded-md bg-gradient-to-r from-[#ED5C32] to-[#EF8935] px-3 py-2 text-sm font-medium text-white hover:opacity-90 sm:px-4"
            >
              <svg className="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
              </svg>
              <span className="hidden sm:inline">Nova manual</span>
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-6 p-6">
        {/* KPIs operacionais */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <button
            onClick={() => handleTabChange("pending")}
            className="text-left rounded-xl border border-[#F5C992]/40 bg-white px-5 py-4 shadow-sm hover:border-amber-300 transition-colors"
          >
            <p className="text-xs font-medium text-stone-500">Pendentes</p>
            <p className="mt-1 text-xl font-bold text-amber-600">{fromCents(kpis.pendingAmount)}</p>
            <p className="mt-0.5 text-xs text-stone-400">{kpis.pending} fatura{kpis.pending !== 1 ? "s" : ""}</p>
          </button>
          <button
            onClick={() => handleTabChange("overdue")}
            className="text-left rounded-xl border border-[#F5C992]/40 bg-white px-5 py-4 shadow-sm hover:border-red-300 transition-colors"
          >
            <p className="text-xs font-medium text-stone-500">Em atraso</p>
            <p className="mt-1 text-xl font-bold text-red-600">{fromCents(kpis.overdueAmount)}</p>
            <p className="mt-0.5 text-xs text-stone-400">{kpis.overdue} vencida{kpis.overdue !== 1 ? "s" : ""}</p>
          </button>
          <button
            onClick={() => handleQuickFilter("today")}
            className={`text-left rounded-xl border bg-white px-5 py-4 shadow-sm transition-colors ${quickFilter === "today" ? "border-orange-400 ring-1 ring-orange-200" : "border-[#F5C992]/40 hover:border-orange-300"}`}
          >
            <p className="text-xs font-medium text-stone-500">A vencer hoje</p>
            <p className="mt-1 text-xl font-bold text-orange-600">{fromCents(kpis.todayAmount)}</p>
            <p className="mt-0.5 text-xs text-stone-400">{kpis.today} fatura{kpis.today !== 1 ? "s" : ""}</p>
          </button>
          <button
            onClick={() => handleQuickFilter("reconciliation")}
            className={`text-left rounded-xl border bg-white px-5 py-4 shadow-sm transition-colors ${quickFilter === "reconciliation" ? "border-violet-400 ring-1 ring-violet-200" : "border-[#F5C992]/40 hover:border-violet-300"}`}
          >
            <p className="text-xs font-medium text-stone-500">Ag. conciliação</p>
            <p className="mt-1 text-xl font-bold text-violet-600">
              {alerts ? fromCents(alerts.pendingReconciliation.totalAmount) : fromCents(kpis.reconciliationAmount)}
            </p>
            <p className="mt-0.5 text-xs text-stone-400">
              {alerts?.pendingReconciliation.count ?? kpis.reconciliation} fatura{(alerts?.pendingReconciliation.count ?? kpis.reconciliation) !== 1 ? "s" : ""}
            </p>
          </button>
        </div>

        {/* Alert strip + quick filter chips */}
        {alerts && (alerts.pendingReviewCount > 0 || alerts.dueIn7Days.count > 0 || alerts.lowAiConfidenceCount > 0 || alerts.pendingReconciliation.count > 0) && (
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
              <button
                onClick={() => handleQuickFilter("week")}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${quickFilter === "week" ? "border-amber-400 bg-amber-100 text-amber-800" : "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"}`}
              >
                <span className="h-2 w-2 rounded-full bg-amber-400" />
                {alerts.dueIn7Days.count} vencem em 7 dias ({fromCents(alerts.dueIn7Days.totalAmount)})
              </button>
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

        {/* Filtros mobile */}
        <div className="flex flex-col gap-2 sm:hidden">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar fornecedor ou nº fatura…"
            className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm focus:outline-none focus:border-[#ED5C32]"
          />
          <div className="flex gap-2">
            {activeTab === "all" && (
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as InvoiceStatus | "")}
                className="flex-1 rounded-md border border-stone-300 bg-white px-3 py-2 text-sm focus:outline-none focus:border-[#ED5C32]"
              >
                <option value="">Todos os estados</option>
                {(Object.entries(INVOICE_STATUS_LABELS) as [InvoiceStatus, string][]).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            )}
            <select
              value={activeTab}
              onChange={(e) => handleTabChange(e.target.value as typeof activeTab)}
              className="flex-1 rounded-md border border-stone-300 bg-white px-3 py-2 text-sm focus:outline-none focus:border-[#ED5C32]"
            >
              <option value="all">Todas ({tabCounts.all})</option>
              <option value="pending">Pendentes ({tabCounts.pending})</option>
              <option value="overdue">Vencidas ({tabCounts.overdue})</option>
            </select>
          </div>
          <button
            onClick={() => setDirectDebitFilter((v) => !v)}
            className={`flex w-full items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
              directDebitFilter
                ? "border-blue-400 bg-blue-50 text-blue-700"
                : "border-stone-300 bg-white text-stone-600"
            }`}
          >
            <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
              directDebitFilter ? "border-blue-500 bg-blue-500" : "border-stone-300"
            }`}>
              {directDebitFilter && (
                <svg className="h-3 w-3 text-white" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                </svg>
              )}
            </span>
            Débito direto
          </button>
        </div>

        {/* Filtros desktop */}
        <div className="hidden sm:flex flex-wrap items-center gap-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar fornecedor ou nº fatura…"
            className="w-64 rounded-md border border-stone-300 bg-white px-3 py-2 text-sm focus:outline-none focus:border-[#ED5C32]"
          />
          {activeTab === "all" && (
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as InvoiceStatus | "")}
              className="rounded-md border border-stone-300 bg-white px-3 py-2 text-sm focus:outline-none focus:border-[#ED5C32]"
            >
              <option value="">Todos os estados</option>
              {(Object.entries(INVOICE_STATUS_LABELS) as [InvoiceStatus, string][]).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          )}
          <button
            onClick={() => setDirectDebitFilter((v) => !v)}
            className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
              directDebitFilter
                ? "border-blue-400 bg-blue-50 text-blue-700"
                : "border-stone-300 bg-white text-stone-600 hover:bg-stone-50"
            }`}
          >
            Débito direto
          </button>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-xl border border-[#F5C992]/40 bg-white">
          {/* Tabs + quick filters — desktop */}
          <div className="hidden sm:flex flex-wrap items-center justify-between border-b border-[#F5C992]/40 px-2">
            <div className="flex">
              {(
                [
                  { key: "all" as const, label: "Todas", badgeCls: "bg-stone-100 text-stone-500" },
                  { key: "pending" as const, label: "Pendentes", badgeCls: tabCounts.pending > 0 ? "bg-amber-100 text-amber-700" : "bg-stone-100 text-stone-400" },
                  { key: "overdue" as const, label: "Em atraso", badgeCls: tabCounts.overdue > 0 ? "bg-red-100 text-red-700" : "bg-stone-100 text-stone-400" },
                ]
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
            {/* Quick filter chips */}
            <div className="flex items-center gap-1.5 pr-2">
              {(
                [
                  { key: "today" as const, label: "Hoje", count: tabCounts.today, cls: "amber" },
                  { key: "week" as const, label: "7 dias", count: tabCounts.week, cls: "orange" },
                  { key: "reconciliation" as const, label: "Ag. conciliação", count: tabCounts.reconciliation, cls: "violet" },
                ] as const
              ).map(({ key, label, count, cls }) => (
                <button
                  key={key}
                  onClick={() => handleQuickFilter(key)}
                  className={`flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ${
                    quickFilter === key
                      ? cls === "amber" ? "border-amber-400 bg-amber-100 text-amber-800"
                        : cls === "orange" ? "border-orange-400 bg-orange-100 text-orange-800"
                        : "border-violet-400 bg-violet-100 text-violet-800"
                      : "border-stone-200 bg-stone-50 text-stone-500 hover:border-stone-300 hover:text-stone-700"
                  }`}
                >
                  {label}
                  {count > 0 && <span className="font-semibold">{count}</span>}
                </button>
              ))}
            </div>
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
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-b border-[#F5C992]/40 bg-stone-50/60">
                  <tr>
                    <th className="w-8 px-3 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.size > 0 && tabFiltered.every((i) => selectedIds.has(i.id))}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedIds(new Set(tabFiltered.map((i) => i.id)));
                          else setSelectedIds(new Set());
                        }}
                        className="h-3.5 w-3.5 rounded border-stone-300 text-[#ED5C32] focus:ring-[#ED5C32]"
                      />
                    </th>
                    <th className="hidden md:table-cell px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">Estado</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">Fornecedor</th>
                    <th className="hidden sm:table-cell px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">Nº Fatura</th>
                    <th className="hidden md:table-cell px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">Vencimento</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-stone-500">Total</th>
                    <th className="hidden lg:table-cell px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">CC Padrão</th>
                    <th className="sticky right-0 bg-stone-50/60 px-4 py-3 shadow-[-1px_0_0_0_rgba(245,201,146,0.4)]" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F5C992]/30">
                  {/* Batch action bar */}
                  {selectedIds.size > 0 && (
                    <tr className="bg-[#ED5C32]/5">
                      <td colSpan={8} className="px-4 py-2">
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-medium text-stone-700">{selectedIds.size} selecionada{selectedIds.size !== 1 ? "s" : ""}</span>
                          <button
                            onClick={() => {
                              const inv = tabFiltered.find((i) => selectedIds.has(i.id) && (i.status === "pending" || i.status === "overdue"));
                              if (inv) setMarkPaidInvoice(inv);
                            }}
                            className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700"
                          >
                            Marcar pagas
                          </button>
                          <button
                            onClick={() => setSelectedIds(new Set())}
                            className="text-xs text-stone-400 hover:text-stone-600"
                          >
                            Cancelar
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                  {tabFiltered.map((inv) => (
                    <tr
                      key={inv.id}
                      className={`group cursor-pointer hover:bg-[#FDF8F5] ${selectedIds.has(inv.id) ? "bg-[#ED5C32]/5" : ""}`}
                      onClick={() => {
                        if (inv.status === "draft_ai" || inv.status === "pending_review") {
                          void handleRowReview(inv);
                        } else {
                          setDetail(inv);
                        }
                      }}
                    >
                      <td
                        className="w-8 px-3 py-3"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={selectedIds.has(inv.id)}
                          onChange={(e) => {
                            const next = new Set(selectedIds);
                            if (e.target.checked) next.add(inv.id);
                            else next.delete(inv.id);
                            setSelectedIds(next);
                          }}
                          className="h-3.5 w-3.5 rounded border-stone-300 text-[#ED5C32] focus:ring-[#ED5C32]"
                        />
                      </td>
                      <td className="hidden md:table-cell px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <StatusBadge status={inv.status} />
                          {inv.reconciliationStatus !== "none" && <ReconciliationBadge status={inv.reconciliationStatus} />}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-medium text-stone-800">
                        <div className="flex items-center gap-2">
                          <span className="md:hidden"><MobileStatusDot status={inv.status} /></span>
                          <span className="max-w-[130px] truncate sm:max-w-none">{inv.supplierName}</span>
                          {inv.isDirectDebit && (
                            <span
                              title={`Débito direto${inv.directDebitDate ? ` em ${formatDate(inv.directDebitDate)}` : ""}`}
                              className="shrink-0 inline-flex items-center rounded-md bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-600"
                            >
                              DD
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="hidden sm:table-cell px-4 py-3 text-xs text-stone-600 sm:text-sm">
                        {inv.invoiceNumber}
                      </td>
                      <td className="hidden md:table-cell px-4 py-3 text-stone-600">
                        <span className={inv.status === "overdue" ? "font-medium text-red-600" : ""}>
                          {formatDate(inv.dueDate)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-stone-800">
                        {fromCents(inv.totalWithVat)}
                      </td>
                      <td className="hidden lg:table-cell px-4 py-3">
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
                      <td
                        className="sticky right-0 z-10 bg-white px-3 py-3 group-hover:bg-[#FDF8F5] shadow-[-1px_0_0_0_rgba(245,201,146,0.4)]"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-0.5">
                          {/* Marcar como paga */}
                          {(inv.status === "pending" || inv.status === "overdue") && (
                            <button
                              onClick={() => setMarkPaidInvoice(inv)}
                              title="Marcar como paga"
                              className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-emerald-600 hover:bg-emerald-50"
                            >
                              <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                              </svg>
                              <span className="hidden md:inline">Paga</span>
                            </button>
                          )}

                          {/* Conciliar */}
                          {inv.reconciliationStatus === "pending_reconciliation" && (
                            <button
                              onClick={() => void handleMarkReconciled(inv.id)}
                              disabled={reconcilingId === inv.id}
                              title="Conciliar pagamento"
                              className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-violet-600 hover:bg-violet-50 disabled:opacity-50"
                            >
                              <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                              </svg>
                              <span className="hidden md:inline">{reconcilingId === inv.id ? "…" : "Conciliar"}</span>
                            </button>
                          )}

                          {/* PDF */}
                          {inv.attachmentUrl && (
                            <a
                              href={inv.attachmentUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Ver PDF"
                              className="rounded-md p-1.5 text-stone-400 hover:bg-stone-50 hover:text-stone-600"
                            >
                              <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M4.5 2A1.5 1.5 0 003 3.5v13A1.5 1.5 0 004.5 18h11a1.5 1.5 0 001.5-1.5V7.621a1.5 1.5 0 00-.44-1.06l-4.12-4.122A1.5 1.5 0 0011.378 2H4.5zm2.25 8.5a.75.75 0 000 1.5h6.5a.75.75 0 000-1.5h-6.5zm0 3a.75.75 0 000 1.5h6.5a.75.75 0 000-1.5h-6.5zm0-6a.75.75 0 000 1.5h3a.75.75 0 000-1.5h-3z" clipRule="evenodd" />
                              </svg>
                            </a>
                          )}

                          {/* Ver / Rever */}
                          <button
                            onClick={() => {
                              if (inv.status === "draft_ai" || inv.status === "pending_review") {
                                void handleRowReview(inv);
                              } else {
                                setDetail(inv);
                              }
                            }}
                            title={inv.status === "draft_ai" || inv.status === "pending_review" ? "Rever fatura" : "Ver detalhes"}
                            className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-[#ED5C32] hover:bg-orange-50"
                          >
                            <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                              <path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
                              <path fillRule="evenodd" d="M.664 10.59a1.651 1.651 0 010-1.186A10.004 10.004 0 0110 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0110 17c-4.257 0-7.893-2.66-9.336-6.41zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                            </svg>
                            <span className="hidden md:inline">
                              {inv.status === "draft_ai" || inv.status === "pending_review" ? "Rever" : "Ver"}
                            </span>
                          </button>

                          {/* Apagar */}
                          <button
                            onClick={() => setDeleteConfirmInvoice(inv)}
                            disabled={deleteMutation.isPending && deleteMutation.variables === inv.id}
                            title="Eliminar fatura"
                            className="rounded-md p-1.5 text-stone-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-40"
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
            </div>
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
            channels={channels}
            groups={groups}
            linkedPayable={payableByInvoiceId.get(detail.id) ?? null}
            onClose={() => setDetail(null)}
            onOpenMarkPaid={setMarkPaidInvoice}
            onInvoiceUpdated={(updated) => setDetail(updated)}
          />
        )}

        {markPaidInvoice && (
          <MarkPaidModal
            invoice={markPaidInvoice}
            onConfirm={(paidAt, bankAccountId, paymentMethod, paymentNotes) => void handleMarkPaid(markPaidInvoice.id, paidAt, bankAccountId, paymentMethod, paymentNotes)}
            onClose={() => setMarkPaidInvoice(null)}
            saving={markingPaidId === markPaidInvoice.id}
          />
        )}

        {deleteConfirmInvoice && (
          <DeleteConfirmModal
            invoice={deleteConfirmInvoice}
            onConfirm={() => deleteMutation.mutate(deleteConfirmInvoice.id)}
            onClose={() => setDeleteConfirmInvoice(null)}
            deleting={deleteMutation.isPending && deleteMutation.variables === deleteConfirmInvoice.id}
          />
        )}
      </div>

      <PageFooter />
    </div>
  );
}
