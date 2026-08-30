import { useState, useMemo, useEffect } from "react";
import { NumericInput } from "../../../../components/NumericInput.tsx";
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
import { useBankStatementsModule } from "../../../bank-statements/bank-statements.module.tsx";
import type { InvoiceLinkedMovementDTO } from "../../../bank-statements/domain/entities/bank-statement.ts";
import type {
  BankDTO,
  AccountPreviewDTO,
} from "../../../bank-accounts/domain/entities/bank-account.ts";
import { ImportInvoiceModal } from "./ImportInvoiceModal.tsx";
import { ReviewImportedInvoiceDrawer } from "./ReviewImportedInvoiceDrawer.tsx";
import { useFinancialBaseModule } from "../../../financial-base/financial-base.module.tsx";
import type {
  CostCenterGroup,
  CostCenterCategory,
  ChannelDTO,
} from "../../../financial-base/domain/entities/cost-center.ts";
import {
  FINANCIAL_TYPE_LABELS,
  FINANCIAL_TYPE_COLORS,
} from "../../../financial-base/domain/entities/cost-center.ts";
import type { FinancialType } from "../../../financial-base/domain/entities/cost-center.ts";
import { usePayableRecurrencesModule } from "../../../payable-recurrences/payable-recurrences.module.tsx";
import type { OccurrenceWithRecurrenceDTO } from "../../../payable-recurrences/domain/entities/recurrence.ts";
import {
  OCCURRENCE_STATUS_LABELS,
  formatPeriod,
} from "../../../payable-recurrences/domain/entities/recurrence.ts";
import { PageFooter } from "../../../../components/PageFooter.tsx";
import { LocationSelect } from "../../../../components/LocationSelect.tsx";

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
  cancelled: "bg-stone-100 text-stone-500",
  review: "bg-purple-50 text-purple-700",
};

const STATUS_DOT: Record<InvoiceStatus, string> = {
  draft_ai: "bg-stone-400",
  pending_review: "bg-purple-500",
  pending: "bg-amber-500",
  paid: "bg-emerald-500",
  overdue: "bg-red-500",
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

// ── ReconciliationBadge ────────────────────────────────────────────────────────

const RECON_CONFIG: Record<
  ReconciliationStatus,
  { label: string; cls: string; dot: string }
> = {
  none: { label: "", cls: "", dot: "" },
  pending_reconciliation: {
    label: "Ag. conciliação",
    cls: "bg-violet-50 text-violet-700",
    dot: "bg-violet-500",
  },
  partially_reconciled: {
    label: "Parcialmente conciliada",
    cls: "bg-amber-50 text-amber-700",
    dot: "bg-amber-500",
  },
  reconciled: {
    label: "Conciliada",
    cls: "bg-teal-50 text-teal-700",
    dot: "bg-teal-500",
  },
};

function ReconciliationBadge({ status }: { status: ReconciliationStatus }) {
  if (status === "none") return null;
  const { label, cls, dot } = RECON_CONFIG[status];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  );
}

// ── MarkPaidModal ─────────────────────────────────────────────────────────────

function bankAccountLabel(bank: BankDTO, acc: AccountPreviewDTO): string {
  const name = acc.nickname ?? acc.label;
  return acc.lastFourDigits
    ? `${name} (${bank.name}) •••• ${acc.lastFourDigits}`
    : `${name} (${bank.name})`;
}

function MarkPaidModal({
  invoice,
  onConfirm,
  onClose,
  saving,
}: {
  invoice: InvoiceDTO;
  onConfirm: (
    paidAt: string,
    bankAccountId: string,
    paymentMethod: PaymentMethod,
    paymentNotes?: string,
  ) => void;
  onClose: () => void;
  saving: boolean;
}) {
  const { api: bankApi } = useBankAccountsModule();
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const [paidAt, setPaidAt] = useState(invoice.paidAt ?? todayStr);
  const [bankAccountId, setBankAccountId] = useState(
    invoice.paymentBankAccountId ?? "",
  );
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | "">(
    (invoice.paymentMethod as PaymentMethod) ?? "",
  );
  const [paymentNotes, setPaymentNotes] = useState(invoice.paymentNotes ?? "");

  const { data: banks = [] } = useQuery({
    queryKey: ["banks-for-payment"],
    queryFn: () => bankApi.listBanks(),
  });

  const allAccounts = useMemo(() => {
    const result: { id: string; label: string }[] = [];
    for (const bank of banks) {
      for (const acc of bank.accountPreviews) {
        if (acc.isActive)
          result.push({ id: acc.id, label: bankAccountLabel(bank, acc) });
      }
    }
    return result;
  }, [banks]);

  const isValid = !!paidAt && !!bankAccountId && !!paymentMethod;

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md rounded-xl bg-white shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4">
          <h3 className="text-base font-bold text-stone-900">
            {invoice.status === "paid"
              ? "Editar pagamento"
              : "Confirmar pagamento"}
          </h3>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-stone-400 hover:bg-stone-100"
          >
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 pb-2 space-y-4">
          {/* Info banner */}
          <div className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2.5 text-xs text-violet-700">
            <p className="font-medium">
              Ao confirmar, esta fatura ficará com o estado
            </p>
            <p className="mt-0.5 font-bold">Aguardando conciliação</p>
            <p className="mt-0.5 text-violet-600">
              e será conciliada automaticamente quando o movimento bancário for
              identificado.
            </p>
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
                <option key={acc.id} value={acc.id}>
                  {acc.label}
                </option>
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
              onChange={(e) =>
                setPaymentMethod(e.target.value as PaymentMethod)
              }
              className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm focus:outline-none focus:border-[#ED5C32]"
            >
              <option value="">— selecionar método —</option>
              {(
                Object.entries(PAYMENT_METHOD_LABELS) as [
                  PaymentMethod,
                  string,
                ][]
              ).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>

          {/* Observação */}
          <div>
            <label className="mb-1 block text-xs font-medium text-stone-600">
              Observação
            </label>
            <textarea
              value={paymentNotes}
              onChange={(e) => setPaymentNotes(e.target.value.slice(0, 200))}
              rows={3}
              placeholder="Pagamento via homebanking…"
              className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm focus:outline-none focus:border-[#ED5C32] resize-none"
            />
            <p className="mt-0.5 text-right text-xs text-stone-400">
              {paymentNotes.length}/200
            </p>
          </div>

          {/* Resumo */}
          <div className="rounded-lg border border-stone-100 bg-stone-50 p-3 text-xs">
            <p className="mb-2 font-semibold text-stone-600">
              Resumo do pagamento
            </p>
            <dl className="divide-y divide-stone-100">
              {[
                { label: "Fornecedor", value: invoice.supplierName },
                { label: "Nº de fatura", value: invoice.invoiceNumber },
                { label: "Vencimento", value: formatDate(invoice.dueDate) },
                {
                  label: "Valor total",
                  value: fromCents(invoice.totalWithVat),
                },
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
            <svg
              className="mt-0.5 h-3.5 w-3.5 shrink-0 text-stone-400"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z"
                clipRule="evenodd"
              />
            </svg>
            O pagamento será registado no sistema e aguardará conciliação
            bancária.
          </p>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 rounded-md border border-stone-300 px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-50"
            >
              Cancelar
            </button>
            <button
              onClick={() =>
                onConfirm(
                  paidAt,
                  bankAccountId,
                  paymentMethod as PaymentMethod,
                  paymentNotes || undefined,
                )
              }
              disabled={saving || !isValid}
              className="flex-1 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {saving ? "A registar…" : "Confirmar pagamento"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
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
  const hasReconciliation = invoice.reconciliationStatus !== "none";
  const hasPayable = invoice.status !== "paid" && invoice.status !== "cancelled";
  const hasWarnings = hasReconciliation || hasPayable;

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl">
        <h3 className="text-base font-bold text-stone-900">Eliminar fatura</h3>
        <p className="mt-2 text-sm text-stone-600">
          Tens a certeza que queres eliminar{" "}
          <span className="font-semibold">{invoice.invoiceNumber}</span> de{" "}
          <span className="font-semibold">{invoice.supplierName}</span>? Esta
          ação é irreversível.
        </p>
        {hasWarnings && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-1.5">
            <p className="text-xs font-semibold text-amber-800">O seguinte será feito automaticamente:</p>
            {hasPayable && (
              <p className="text-xs text-amber-700">
                • A conta a pagar associada será cancelada.
              </p>
            )}
            {hasReconciliation && (
              <p className="text-xs text-amber-700">
                • As ligações de conciliação bancária serão removidas e os movimentos associados actualizados.
              </p>
            )}
          </div>
        )}
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
    document.body,
  );
}

// ── Line Classify Panel ────────────────────────────────────────────────────────

// ── Add Line Form ──────────────────────────────────────────────────────────────

interface AddLineFormProps {
  invoiceId: string;
  categories: CostCenterCategory[];
  onDone: (line: InvoiceLineDTO) => void;
  onCancel: () => void;
}

function AddLineForm({
  invoiceId,
  categories,
  onDone,
  onCancel,
}: AddLineFormProps) {
  const { api } = useInvoicesModule();
  const [description, setDescription] = useState("");
  const [type, setType] = useState<InvoiceLineType>("other");
  const [quantity, setQuantity] = useState("1");
  const [unit, setUnit] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [vatRate, setVatRate] = useState("23");
  const [catId, setCatId] = useState("");
  const [locationId, setLocationId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const subtotal = parseFloat(quantity || "0") * parseFloat(unitCost || "0");
  const vatAmount = Math.round(subtotal * (parseFloat(vatRate) / 100) * 100);
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
        locationId,
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
      <div className="grid grid-cols-2 gap-2">
        <div>
          <NumericInput
            decimals={3}
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
          <NumericInput
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
        {categories
          .filter((c) => c.isActive)
          .map((c) => (
            <option key={c.id} value={c.id}>
              {c.code} — {c.name}
            </option>
          ))}
      </select>
      {/* Store (D4): optional — a cost may belong to the whole organization and to no store */}
      <LocationSelect
        value={locationId}
        onChange={setLocationId}
        allowUnset
        label="Loja"
      />
      {subtotal > 0 && (
        <p className="text-xs text-stone-500 tabular-nums">
          Total c/ IVA:{" "}
          <span className="font-semibold text-stone-800">
            {(totalCents / 100).toLocaleString("pt-PT", {
              style: "currency",
              currency: "EUR",
            })}
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
  categories,
  onDone,
  onCancel,
}: {
  line: InvoiceLineDTO;
  invoiceId: string;
  categories: CostCenterCategory[];
  onDone: (updated: InvoiceLineDTO) => void;
  onCancel: () => void;
}) {
  const { api } = useInvoicesModule();
  const [description, setDescription] = useState(line.description);
  const [type, setType] = useState<InvoiceLineType>(line.type);
  const [quantity, setQuantity] = useState(String(line.quantity));
  const [unit, setUnit] = useState(line.unit ?? "");
  const [unitCost, setUnitCost] = useState(
    String(line.unitCostWithoutVat / 100),
  );
  const [vatRate, setVatRate] = useState(String(line.vatRate));
  const [catId, setCatId] = useState(line.costCenterCategoryId ?? "");
  const [locationId, setLocationId] = useState<string | null>(line.locationId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subtotal = parseFloat(quantity || "0") * parseFloat(unitCost || "0");
  const vatAmount = Math.round(subtotal * (parseFloat(vatRate) / 100) * 100);
  const totalCents = Math.round(subtotal * 100) + vatAmount;

  async function handleSave() {
    if (!description || !unitCost) return;
    setSaving(true);
    setError(null);
    try {
      await api.updateLine(invoiceId, line.id, {
        description,
        quantity: parseFloat(quantity),
        unit: unit || null,
        unitCostWithoutVat: Math.round(parseFloat(unitCost) * 100),
        vatRate: parseFloat(vatRate),
        vatAmount,
        totalWithVat: totalCents,
        locationId,
      });
      const classified = await api.classifyLine(invoiceId, line.id, {
        classify: {
          type,
          costCenterCategoryId: catId || null,
        },
      });
      onDone(classified);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void handleSave();
      }}
      className="space-y-3 rounded-lg border border-[#F5C992]/60 bg-[#FDF8F5] p-3 text-sm"
    >
      <p className="text-xs font-semibold text-stone-600">Editar linha</p>
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
      <div className="grid grid-cols-2 gap-2">
        <div>
          <NumericInput
            decimals={3}
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
          <NumericInput
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
      <select
        value={catId}
        onChange={(e) => setCatId(e.target.value)}
        className="w-full rounded-md border border-stone-300 bg-white px-2 py-1.5 text-xs focus:outline-none focus:border-[#ED5C32]"
      >
        <option value="">Subcategoria CC</option>
        {categories
          .filter((c) => c.isActive)
          .map((c) => (
            <option key={c.id} value={c.id}>
              {c.code} — {c.name}
            </option>
          ))}
      </select>
      {/* Store (D4): optional — a cost may belong to the whole organization and to no store */}
      <LocationSelect
        value={locationId}
        onChange={setLocationId}
        allowUnset
        label="Loja"
      />
      {subtotal > 0 && (
        <p className="text-xs text-stone-500 tabular-nums">
          Total c/ IVA:{" "}
          <span className="font-semibold text-stone-800">
            {(totalCents / 100).toLocaleString("pt-PT", {
              style: "currency",
              currency: "EUR",
            })}
          </span>
        </p>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
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
          {saving ? "A guardar…" : "Guardar"}
        </button>
      </div>
    </form>
  );
}

// ── Invoice Detail Drawer ──────────────────────────────────────────────────────

interface DetailDrawerProps {
  invoice: InvoiceDTO | null;
  categories: CostCenterCategory[];
  channels: ChannelDTO[];
  groups: CostCenterGroup[];
  bankAccounts: { id: string; label: string }[];
  onClose: () => void;
  onOpenMarkPaid: (inv: InvoiceDTO) => void;
  onInvoiceUpdated?: (inv: InvoiceDTO) => void;
}

function InvoiceDetailDrawer({
  invoice,
  categories,
  channels: _channels,
  groups,
  bankAccounts,
  onClose,
  onOpenMarkPaid,
  onInvoiceUpdated,
}: DetailDrawerProps) {
  const { api } = useInvoicesModule();
  const { api: bankApi } = useBankStatementsModule();
  const { api: recurrencesApi } = usePayableRecurrencesModule();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"details" | "lines">("details");
  const [lines, setLines] = useState<InvoiceLineDTO[]>([]);
  const [loadingLines, setLoadingLines] = useState(false);
  const [showAddLine, setShowAddLine] = useState(false);
  const [settingLineMode, setSettingLineMode] = useState<"idle" | "loading">(
    "idle",
  );
  const [showSimpleConfirm, setShowSimpleConfirm] = useState(false);
  const [confirmDeleteLineId, setConfirmDeleteLineId] = useState<string | null>(
    null,
  );
  const [showPdf, setShowPdf] = useState(false);
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [classifyingLineId, setClassifyingLineId] = useState<string | null>(
    null,
  );
  const [editingClassification, setEditingClassification] = useState(false);
  const [savingClassification, setSavingClassification] = useState(false);
  const [classifyGroupId, setClassifyGroupId] = useState("");
  const [classifyCategoryId, setClassifyCategoryId] = useState("");
  // Invoice completo (com classificationSummary calculado a partir das linhas reais)
  const [fullInvoice, setFullInvoice] = useState<InvoiceDTO | null>(null);
  const [undoingPaid, setUndoingPaid] = useState(false);
  const [showUndoPaidConfirm, setShowUndoPaidConfirm] = useState(false);
  const [editingNumber, setEditingNumber] = useState(false);
  const [editNumberValue, setEditNumberValue] = useState("");
  const [savingNumber, setSavingNumber] = useState(false);
  const [numberError, setNumberError] = useState<string | null>(null);

  // Fetch eager do invoice completo ao abrir o drawer
  useEffect(() => {
    if (!invoice) return;
    setFullInvoice(null);
    void api.getInvoice(invoice.id).then(setFullInvoice);
  }, [invoice?.id]);

  // Para renderização: usar fullInvoice (com classificationSummary real) quando disponível
  const inv = fullInvoice ?? invoice!;

  const isReconciled =
    invoice?.reconciliationStatus !== "none" &&
    invoice?.reconciliationStatus != null;
  const { data: linkedMovements = [] } = useQuery<InvoiceLinkedMovementDTO[]>({
    queryKey: ["invoice-linked-movements", invoice?.id],
    queryFn: () => bankApi.getMovementsLinkedToInvoice(invoice!.id),
    enabled: isReconciled && !!invoice,
  });
  const { data: linkedRecurrenceOcc } = useQuery<OccurrenceWithRecurrenceDTO | null>({
    queryKey: ["occurrence-by-invoice", invoice?.id],
    queryFn: () => recurrencesApi.getOccurrenceByInvoiceId(invoice!.id),
    enabled: !!invoice,
  });

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
    setEditingClassification(false);
    if (t === "lines" && invoice) void loadLines(invoice);
  }

  function refreshFullInvoice() {
    if (!invoice) return;
    void api.getInvoice(invoice.id).then((fresh) => {
      setFullInvoice(fresh);
      if (onInvoiceUpdated) onInvoiceUpdated(fresh);
    });
  }

  function handleLineUpdated(updated: InvoiceLineDTO) {
    setLines((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
    void qc.invalidateQueries({ queryKey: ["invoices"] });
    refreshFullInvoice();
  }

  async function handleLineDeleted(lineId: string) {
    if (!invoice) return;
    await api.deleteLine(invoice.id, lineId);
    setLines((prev) => prev.filter((l) => l.id !== lineId));
    setEditingLineId(null);
    setClassifyingLineId(null);
    void qc.invalidateQueries({ queryKey: ["invoices"] });
    void qc.invalidateQueries({ queryKey: ["invoice-lines-all"] });
    refreshFullInvoice();
  }

  function handleLineAdded(newLine: InvoiceLineDTO) {
    setLines((prev) => [...prev, newLine]);
    setShowAddLine(false);
    void qc.invalidateQueries({ queryKey: ["invoices"] });
    void qc.invalidateQueries({ queryKey: ["invoice-lines-all"] });
    refreshFullInvoice();
  }

  async function handleToggleLineDetailMode(mode: LineDetailMode) {
    if (!invoice) return;
    setSettingLineMode("loading");
    try {
      const updated = await api.setLineDetailMode(invoice.id, mode);
      void qc.invalidateQueries({ queryKey: ["invoices"] });
      if (onInvoiceUpdated) onInvoiceUpdated(updated);
      // Ao voltar para simple, o backend apaga as linhas — limpar estado local
      if (mode === "simple") setLines([]);
    } finally {
      setSettingLineMode("idle");
    }
  }

  function handleLineModeToggleClick() {
    if (!invoice) return;
    if (invoice.lineDetailMode === "detailed" && lines.length > 0) {
      setShowSimpleConfirm(true);
    } else {
      void handleToggleLineDetailMode(
        invoice.lineDetailMode === "detailed" ? "simple" : "detailed",
      );
    }
  }

  async function handleSaveNumber() {
    if (!invoice || !editNumberValue.trim()) return;
    setSavingNumber(true);
    setNumberError(null);
    try {
      const updated = await api.updateInvoice(invoice.id, { invoiceNumber: editNumberValue.trim() });
      void qc.invalidateQueries({ queryKey: ["invoices"] });
      if (onInvoiceUpdated) onInvoiceUpdated(updated);
      setFullInvoice(updated);
      setEditingNumber(false);
    } catch (e: unknown) {
      setNumberError(e instanceof Error ? e.message : "Erro ao guardar");
    } finally {
      setSavingNumber(false);
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

  return createPortal(
    <div className="fixed inset-0 z-50 flex" aria-modal="true">
      <div className="flex-1 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <aside
        className={`flex h-full w-full bg-white shadow-2xl transition-[max-width] duration-300 ${showPdf && invoice.attachmentUrl ? "max-w-[1280px]" : "max-w-2xl"}`}
      >
        {/* Left column */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-start justify-between border-b border-[#F5C992]/40 px-6 py-4">
            <div>
              <p className="text-xs font-medium text-stone-400">Fatura</p>
              <h2 className="text-lg font-bold text-stone-800">
                {invoice.supplierName}
              </h2>
              <p className="flex items-center gap-1.5 text-sm text-stone-500">
                {editingNumber ? (
                  <span className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={editNumberValue}
                      onChange={(e) => setEditNumberValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void handleSaveNumber();
                        if (e.key === "Escape") setEditingNumber(false);
                      }}
                      className="rounded border border-[#ED5C32] px-2 py-0.5 text-sm text-stone-800 focus:outline-none"
                      style={{ width: Math.max(editNumberValue.length, 10) + "ch" }}
                      autoFocus
                    />
                    <button
                      onClick={() => void handleSaveNumber()}
                      disabled={savingNumber || !editNumberValue.trim()}
                      className="rounded bg-[#ED5C32] px-2 py-0.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
                    >
                      {savingNumber ? "…" : "Guardar"}
                    </button>
                    <button
                      onClick={() => { setEditingNumber(false); setNumberError(null); }}
                      className="text-xs text-stone-400 hover:text-stone-600"
                    >
                      Cancelar
                    </button>
                    {numberError && <span className="text-xs text-red-600">{numberError}</span>}
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    {invoice.invoiceNumber}
                    <button
                      onClick={() => { setEditNumberValue(invoice.invoiceNumber); setEditingNumber(true); setNumberError(null); }}
                      className="rounded p-0.5 text-stone-300 hover:text-[#ED5C32]"
                      title="Editar número de fatura"
                    >
                      <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                      </svg>
                    </button>
                  </span>
                )}
                {!editingNumber && <span>· {formatDate(invoice.invoiceDate)}</span>}
              </p>
              <p className="mt-1 text-xs text-stone-400">
                Data de vencimento: {formatDate(invoice.dueDate)} · Data de
                pagamento: {formatDate(invoice.paidAt)}
              </p>
              {invoice.notes && (
                <p className="mt-0.5 text-xs text-stone-400">
                  Notas: {invoice.notes}
                </p>
              )}
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
                <svg
                  className="h-5 w-5"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                </svg>
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-[#F5C992]/40 px-6">
            {(
              [
                { key: "details", label: "Detalhes" },
                { key: "lines", label: "Linhas" },
              ] as const
            ).map(({ key, label }) => (
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
              <div className="space-y-3">
                {/* Actions */}
                {(invoice.status === "pending" ||
                  invoice.status === "overdue") && (
                  <div className="flex justify-end">
                    <button
                      onClick={() => onOpenMarkPaid(invoice)}
                      className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
                    >
                      Marcar como paga
                    </button>
                  </div>
                )}

                {/* Cards — 2 colunas masonry: distribuição esquerda→direita por ordem */}
                {(() => {
                  const cardTotais = (
                    <div
                      key="totais"
                      className="rounded-lg border border-stone-200 p-4 space-y-2"
                    >
                      <p className="text-xs font-semibold text-stone-500">
                        Totais da fatura
                      </p>
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs text-stone-500">
                          <span>Sem IVA</span>
                          <span>{fromCents(invoice.subtotalWithoutVat)}</span>
                        </div>
                        <div className="flex justify-between text-xs text-stone-500">
                          <span>IVA</span>
                          <span>{fromCents(invoice.totalVat)}</span>
                        </div>
                      </div>
                      <div className="border-t border-stone-100 pt-2 flex justify-between">
                        <span className="text-sm font-semibold text-stone-800">
                          Total
                        </span>
                        <span className="text-sm font-bold text-stone-800">
                          {fromCents(invoice.totalWithVat)}
                        </span>
                      </div>
                      {inv.lineDetailMode === "detailed" &&
                        inv.linesSummary &&
                        (() => {
                          const saldo =
                            inv.linesSummary.totalWithVat -
                            invoice.totalWithVat;
                          const balanced = Math.abs(saldo) <= 1;
                          return (
                            <div className="flex justify-between text-xs">
                              <span className="text-stone-400">
                                Saldo das linhas
                              </span>
                              <span
                                className={`font-bold ${balanced ? "text-emerald-600" : "text-red-600"}`}
                              >
                                {saldo >= 0
                                  ? fromCents(saldo)
                                  : `−${fromCents(Math.abs(saldo))}`}
                              </span>
                            </div>
                          );
                        })()}
                    </div>
                  );

                  const cardClassificacao = (
                    <div
                      key="classificacao"
                      className="rounded-lg border border-stone-200 p-4 space-y-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-stone-500">
                          Classificação
                        </p>
                        {inv.lineDetailMode === "detailed" ||
                        inv.classificationSummary.mode === "mixed" ? (
                          <button
                            onClick={() => handleTabChange("lines")}
                            className="text-xs text-stone-400 hover:text-stone-600"
                          >
                            Editar nas Linhas →
                          </button>
                        ) : (
                          !editingClassification && (
                            <button
                              onClick={() => {
                                setClassifyGroupId(
                                  invoice.costCenterGroupId ?? "",
                                );
                                setClassifyCategoryId(
                                  invoice.costCenterCategoryId ?? "",
                                );
                                setEditingClassification(true);
                              }}
                              className="text-xs font-medium text-[#ED5C32] hover:underline"
                            >
                              Editar
                            </button>
                          )
                        )}
                      </div>

                      {inv.classificationSummary.mode === "unique" && (
                        <span className="inline-flex items-center rounded-full bg-teal-50 px-2 py-0.5 text-[11px] font-medium text-teal-700">
                          Classificação única
                        </span>
                      )}
                      {inv.classificationSummary.mode === "mixed" && (
                        <span className="inline-flex items-center rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700">
                          Classificação mista ·{" "}
                          {inv.classificationSummary.entries.length} categorias
                        </span>
                      )}
                      {inv.classificationSummary.mode === "none" &&
                        !editingClassification && (
                          <span className="inline-flex items-center rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-500">
                            Não classificada
                          </span>
                        )}

                      {editingClassification ? (
                        <div className="space-y-2.5 rounded-lg border border-[#F5C992]/60 bg-[#FDF8F5] p-3">
                          <div>
                            <label className="mb-1 block text-xs font-medium text-stone-600">
                              Centro de custo
                            </label>
                            <select
                              value={classifyGroupId}
                              onChange={(e) => {
                                setClassifyGroupId(e.target.value);
                                setClassifyCategoryId("");
                              }}
                              className="w-full rounded-md border border-stone-300 bg-white px-2 py-1.5 text-xs focus:outline-none focus:border-[#ED5C32]"
                            >
                              <option value="">— nenhum —</option>
                              {groups.map((g) => (
                                <option key={g.id} value={g.id}>
                                  {g.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-medium text-stone-600">
                              Subcategoria
                            </label>
                            <select
                              value={classifyCategoryId}
                              onChange={(e) =>
                                setClassifyCategoryId(e.target.value)
                              }
                              className="w-full rounded-md border border-stone-300 bg-white px-2 py-1.5 text-xs focus:outline-none focus:border-[#ED5C32]"
                            >
                              <option value="">— nenhuma —</option>
                              {categories
                                .filter(
                                  (c) =>
                                    c.isActive &&
                                    (!classifyGroupId ||
                                      c.groupId === classifyGroupId),
                                )
                                .map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.code} — {c.name}
                                  </option>
                                ))}
                            </select>
                            {classifyCategoryId &&
                              (() => {
                                const cat = categories.find(
                                  (c) => c.id === classifyCategoryId,
                                );
                                return cat ? (
                                  <span
                                    className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${FINANCIAL_TYPE_COLORS[cat.financialType as FinancialType]}`}
                                  >
                                    {
                                      FINANCIAL_TYPE_LABELS[
                                        cat.financialType as FinancialType
                                      ]
                                    }
                                  </span>
                                ) : null;
                              })()}
                          </div>
                          <div className="flex gap-2">
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
                      ) : inv.classificationSummary.mode !== "none" ? (
                        <div className="divide-y divide-stone-100">
                          {inv.classificationSummary.entries.map((entry) => (
                            <div
                              key={entry.costCenterCategoryId}
                              className="flex items-start justify-between gap-2 py-2 first:pt-0"
                            >
                              <div className="min-w-0">
                                <p className="text-xs font-medium text-stone-700 truncate">
                                  {entry.code} — {entry.name}
                                </p>
                                {entry.financialType && (
                                  <span
                                    className={`mt-0.5 inline-block rounded-full px-1.5 py-0.5 text-[10px] font-medium ${FINANCIAL_TYPE_COLORS[entry.financialType as FinancialType] ?? "bg-stone-100 text-stone-500"}`}
                                  >
                                    {FINANCIAL_TYPE_LABELS[
                                      entry.financialType as FinancialType
                                    ] ?? entry.financialType}
                                  </span>
                                )}
                              </div>
                              {inv.classificationSummary.mode === "mixed" && (
                                <p className="shrink-0 text-xs font-semibold text-stone-700">
                                  {fromCents(entry.totalWithVat)}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );

                  const cardConciliacao = isReconciled ? (
                    <div
                      key="conciliacao"
                      className="rounded-lg border border-stone-200 p-4 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-stone-500">
                          Conciliação bancária
                        </p>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${RECON_CONFIG[invoice.reconciliationStatus].cls}`}
                        >
                          {RECON_CONFIG[invoice.reconciliationStatus].label}
                        </span>
                      </div>
                      {linkedMovements.length === 0 ? (
                        <p className="text-xs text-stone-400">
                          A carregar movimentos…
                        </p>
                      ) : (
                        <div className="divide-y divide-stone-100">
                          {linkedMovements.map((m) => (
                            <div
                              key={m.movementId}
                              className="flex items-start justify-between gap-2 py-2 first:pt-0"
                            >
                              <div className="min-w-0">
                                <p className="text-xs font-medium text-stone-700">
                                  {formatDate(m.bookingDate)}
                                </p>
                                <p className="text-[11px] text-stone-400 truncate">
                                  {m.description}
                                </p>
                              </div>
                              <p className="shrink-0 text-xs font-semibold text-stone-700">
                                {fromCents(m.allocatedAmountCents)}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : null;


                  const cardRecorrencia = linkedRecurrenceOcc ? (
                    <div
                      key="recorrencia"
                      className="rounded-lg border border-stone-200 p-4 space-y-2"
                    >
                      <p className="text-xs font-semibold text-stone-500">
                        Recorrência associada
                      </p>
                      <div className="divide-y divide-stone-100">
                        {[
                          {
                            label: "Nome",
                            value: linkedRecurrenceOcc.recurrenceName,
                          },
                          {
                            label: "Período",
                            value: formatPeriod(linkedRecurrenceOcc.occurrence.period),
                          },
                          {
                            label: "Estado",
                            value: OCCURRENCE_STATUS_LABELS[linkedRecurrenceOcc.occurrence.status],
                          },
                        ].map(({ label, value }) => (
                          <div
                            key={label}
                            className="flex justify-between py-2 first:pt-0"
                          >
                            <dt className="text-xs text-stone-400">{label}</dt>
                            <dd className="text-xs font-medium text-stone-700">
                              {value}
                            </dd>
                          </div>
                        ))}
                      </div>
                      <button
                        onClick={() => {
                          onClose();
                          navigate(
                            `/financial/recurrences/${linkedRecurrenceOcc.occurrence.recurrenceId}`,
                          );
                        }}
                        className="text-xs font-medium text-[#ED5C32] hover:underline"
                      >
                        Ver recorrência →
                      </button>
                    </div>
                  ) : null;

                  const cardPayamento =
                    invoice.status === "paid" && invoice.paidAt
                      ? (() => {
                          const accountLabel = invoice.paymentBankAccountId
                            ? (bankAccounts.find(
                                (a) => a.id === invoice.paymentBankAccountId,
                              )?.label ?? "—")
                            : "—";
                          return (
                            <div
                              key="pagamento"
                              className="rounded-lg border border-stone-200 p-4 space-y-2"
                            >
                              <p className="text-xs font-semibold text-stone-500">
                                Pagamento
                              </p>
                              <div className="divide-y divide-stone-100">
                                {[
                                  {
                                    label: "Pago em",
                                    value: formatDate(invoice.paidAt),
                                  },
                                  {
                                    label: "Método",
                                    value: invoice.paymentMethod
                                      ? (PAYMENT_METHOD_LABELS[
                                          invoice.paymentMethod as PaymentMethod
                                        ] ?? invoice.paymentMethod)
                                      : "—",
                                  },
                                  { label: "Conta", value: accountLabel },
                                ].map(({ label, value }) => (
                                  <div
                                    key={label}
                                    className="flex justify-between py-2 first:pt-0"
                                  >
                                    <dt className="text-xs text-stone-400">
                                      {label}
                                    </dt>
                                    <dd className="text-xs font-medium text-stone-700">
                                      {value}
                                    </dd>
                                  </div>
                                ))}
                              </div>
                              <div className="flex gap-2 pt-1">
                                <button
                                  onClick={() => onOpenMarkPaid(invoice)}
                                  className="flex-1 rounded-md border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50"
                                >
                                  Editar pagamento
                                </button>
                                <button
                                  disabled={undoingPaid}
                                  onClick={() => setShowUndoPaidConfirm(true)}
                                  className="flex-1 rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 disabled:opacity-50"
                                >
                                  {undoingPaid ? "A desfazer…" : "Desfazer"}
                                </button>
                              </div>
                            </div>
                          );
                        })()
                      : null;

                  const missing: string[] = [
                    !cardPayamento && "Sem pagamento registado",
                    !cardRecorrencia && "Sem recorrência associada",
                    !cardConciliacao && "Sem conciliação bancária",
                  ].filter(Boolean) as string[];

                  const cardMissing =
                    missing.length > 0 ? (
                      <div
                        key="missing"
                        className="rounded-lg border border-dashed border-stone-200 p-4 space-y-2"
                      >
                        <p className="text-xs font-semibold text-stone-400">
                          Informação em falta
                        </p>
                        <ul className="space-y-1.5">
                          {missing.map((label) => (
                            <li
                              key={label}
                              className="flex items-center gap-2 text-xs text-stone-400"
                            >
                              <span className="h-1 w-1 rounded-full bg-stone-300 shrink-0" />
                              {label}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null;

                  const cards = [
                    cardTotais,
                    cardClassificacao,
                    cardPayamento,
                    cardRecorrencia,
                    cardConciliacao,
                    cardMissing,
                  ].filter(Boolean);
                  const leftCards = cards.filter((_, i) => i % 2 === 0);
                  const rightCards = cards.filter((_, i) => i % 2 !== 0);

                  return (
                    <div className="grid grid-cols-2 gap-3 items-start">
                      <div className="flex flex-col gap-3">{leftCards}</div>
                      <div className="flex flex-col gap-3">{rightCards}</div>
                    </div>
                  );
                })()}

                {/* Impacto financeiro */}
                <div className="flex items-center justify-between rounded-lg border border-stone-100 bg-stone-50 px-4 py-2.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-400 shrink-0">
                    Impacto financeiro
                  </p>
                  <div className="flex items-center gap-1.5">
                    {[
                      { label: "DRE", value: invoice.affectsDre },
                      {
                        label: "Fluxo de Caixa",
                        value: invoice.affectsCashflow,
                      },
                      {
                        label: "Rentabilidade",
                        value: invoice.affectsProfitability,
                      },
                    ].map(({ label, value }, i, arr) => (
                      <span
                        key={label}
                        className="flex items-center gap-1 text-xs"
                      >
                        <span className="text-stone-500">{label}:</span>
                        <span
                          className={`font-semibold ${value ? "text-teal-600" : "text-stone-400"}`}
                        >
                          {value ? "Sim" : "Não"}
                        </span>
                        {i < arr.length - 1 && (
                          <span className="ml-1.5 text-stone-200">|</span>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {tab === "lines" && (
              <div className="space-y-3">
                {/* ── SIMPLE MODE ── */}
                {invoice.lineDetailMode === "simple" && (
                  <div className="space-y-3">
                    {/* Totais — horizontal */}
                    <div className="flex items-center justify-between rounded-lg border border-stone-200 px-4 py-3">
                      <p className="shrink-0 text-xs font-semibold text-stone-500">
                        Totais da fatura
                      </p>
                      <div className="flex items-center gap-3 text-xs">
                        <span className="text-stone-500">
                          Sem IVA{" "}
                          <span className="font-medium text-stone-700">
                            {fromCents(invoice.subtotalWithoutVat)}
                          </span>
                        </span>
                        <span className="text-stone-200">|</span>
                        <span className="text-stone-500">
                          IVA{" "}
                          <span className="font-medium text-stone-700">
                            {fromCents(invoice.totalVat)}
                          </span>
                        </span>
                        <span className="text-stone-200">|</span>
                        <span className="font-semibold text-stone-800">
                          Total{" "}
                          <span className="font-bold">
                            {fromCents(invoice.totalWithVat)}
                          </span>
                        </span>
                      </div>
                    </div>

                    {/* Classificação — horizontal, colapsável */}
                    <div className="rounded-lg border border-stone-200">
                      <div className="flex items-center justify-between gap-3 px-4 py-3">
                        <p className="shrink-0 text-xs font-semibold text-stone-500">
                          Classificação
                        </p>
                        {inv.classificationSummary.mode === "none" &&
                          !editingClassification && (
                            <span className="inline-flex items-center rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-500">
                              Não classificada
                            </span>
                          )}
                        {inv.classificationSummary.mode !== "none" &&
                          !editingClassification &&
                          (() => {
                            const entry = inv.classificationSummary.entries[0];
                            const cat = categories.find(
                              (c) => c.id === entry.costCenterCategoryId,
                            );
                            const group = cat
                              ? groups.find((g) => g.id === cat.groupId)
                              : null;
                            return (
                              <div className="flex min-w-0 items-center gap-2">
                                <span className="truncate text-xs font-medium text-stone-700">
                                  {group ? group.name : entry.code} —{" "}
                                  {entry.name}
                                </span>
                                {entry.financialType && (
                                  <span
                                    className={`shrink-0 inline-block rounded-full px-1.5 py-0.5 text-[10px] font-medium ${FINANCIAL_TYPE_COLORS[entry.financialType as FinancialType] ?? "bg-stone-100 text-stone-500"}`}
                                  >
                                    {FINANCIAL_TYPE_LABELS[
                                      entry.financialType as FinancialType
                                    ] ?? entry.financialType}
                                  </span>
                                )}
                              </div>
                            );
                          })()}
                        <div>
                          {!editingClassification ? (
                            <button
                              onClick={() => {
                                setClassifyGroupId(
                                  invoice.costCenterGroupId ?? "",
                                );
                                setClassifyCategoryId(
                                  invoice.costCenterCategoryId ?? "",
                                );
                                setEditingClassification(true);
                              }}
                              className="text-xs font-medium text-[#ED5C32] hover:underline"
                            >
                              Editar
                            </button>
                          ) : (
                            <button
                              onClick={() => setEditingClassification(false)}
                              className="text-xs text-stone-400 hover:text-stone-600"
                            >
                              Cancelar
                            </button>
                          )}
                        </div>
                      </div>

                      {editingClassification && (
                        <div className="space-y-2.5 border-t border-stone-100 bg-[#FDF8F5] px-4 py-3">
                          <div>
                            <label className="mb-1 block text-xs font-medium text-stone-600">
                              Centro de custo
                            </label>
                            <select
                              value={classifyGroupId}
                              onChange={(e) => {
                                setClassifyGroupId(e.target.value);
                                setClassifyCategoryId("");
                              }}
                              className="w-full rounded-md border border-stone-300 bg-white px-2 py-1.5 text-xs focus:outline-none focus:border-[#ED5C32]"
                            >
                              <option value="">— nenhum —</option>
                              {groups.map((g) => (
                                <option key={g.id} value={g.id}>
                                  {g.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-medium text-stone-600">
                              Subcategoria
                            </label>
                            <select
                              value={classifyCategoryId}
                              onChange={(e) =>
                                setClassifyCategoryId(e.target.value)
                              }
                              className="w-full rounded-md border border-stone-300 bg-white px-2 py-1.5 text-xs focus:outline-none focus:border-[#ED5C32]"
                            >
                              <option value="">— nenhuma —</option>
                              {categories
                                .filter(
                                  (c) =>
                                    c.isActive &&
                                    (!classifyGroupId ||
                                      c.groupId === classifyGroupId),
                                )
                                .map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.code} — {c.name}
                                  </option>
                                ))}
                            </select>
                            {classifyCategoryId &&
                              (() => {
                                const cat = categories.find(
                                  (c) => c.id === classifyCategoryId,
                                );
                                return cat ? (
                                  <span
                                    className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${FINANCIAL_TYPE_COLORS[cat.financialType as FinancialType]}`}
                                  >
                                    {
                                      FINANCIAL_TYPE_LABELS[
                                        cat.financialType as FinancialType
                                      ]
                                    }
                                  </span>
                                ) : null;
                              })()}
                          </div>
                          <div className="flex justify-end">
                            <button
                              onClick={() => void handleSaveClassification()}
                              disabled={savingClassification}
                              className="rounded-md bg-gradient-to-r from-[#ED5C32] to-[#EF8935] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
                            >
                              {savingClassification ? "A guardar…" : "Guardar"}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Impacto financeiro */}
                    <div className="flex items-center justify-between rounded-lg border border-stone-100 bg-stone-50 px-4 py-2.5">
                      <p className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-stone-400">
                        Impacto financeiro
                      </p>
                      <div className="flex items-center gap-1.5">
                        {[
                          { label: "DRE", value: invoice.affectsDre },
                          {
                            label: "Fluxo de Caixa",
                            value: invoice.affectsCashflow,
                          },
                          {
                            label: "Rentabilidade",
                            value: invoice.affectsProfitability,
                          },
                        ].map(({ label, value }, i, arr) => (
                          <span
                            key={label}
                            className="flex items-center gap-1 text-xs"
                          >
                            <span className="text-stone-500">{label}:</span>
                            <span
                              className={`font-semibold ${value ? "text-teal-600" : "text-stone-400"}`}
                            >
                              {value ? "Sim" : "Não"}
                            </span>
                            {i < arr.length - 1 && (
                              <span className="ml-1.5 text-stone-200">|</span>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Botão ativar detalhamento */}
                    <div className="flex justify-end">
                      <button
                        onClick={handleLineModeToggleClick}
                        disabled={settingLineMode === "loading"}
                        className="rounded-lg border border-[#ED5C32] px-4 py-3 text-xs font-medium text-[#ED5C32] hover:bg-[#ED5C32]/5 disabled:opacity-50"
                      >
                        {settingLineMode === "loading"
                          ? "A activar…"
                          : "Ativar detalhamento por linhas"}
                      </button>
                    </div>
                  </div>
                )}

                {/* ── DETAILED MODE ── */}
                {invoice.lineDetailMode === "detailed" && (
                  <div className="space-y-3">
                    {/* Totais das linhas — topo, sempre visível */}
                    {!loadingLines &&
                      (() => {
                        const subtotal = lines.reduce(
                          (s, l) => s + (l.totalWithVat - l.vatAmount),
                          0,
                        );
                        const vat = lines.reduce((s, l) => s + l.vatAmount, 0);
                        const total = lines.reduce(
                          (s, l) => s + l.totalWithVat,
                          0,
                        );
                        const saldo = total - invoice.totalWithVat;
                        const balanced = Math.abs(saldo) <= 1;
                        return (
                          <div className="flex items-center justify-between rounded-lg border border-stone-200 px-4 py-3">
                            <p className="shrink-0 text-xs font-semibold text-stone-500">
                              Totais das linhas
                            </p>
                            <div className="flex items-center gap-3 text-xs">
                              <span className="text-stone-500">
                                Sem IVA{" "}
                                <span className="font-medium text-stone-700">
                                  {fromCents(subtotal)}
                                </span>
                              </span>
                              <span className="text-stone-200">|</span>
                              <span className="text-stone-500">
                                IVA{" "}
                                <span className="font-medium text-stone-700">
                                  {fromCents(vat)}
                                </span>
                              </span>
                              <span className="text-stone-200">|</span>
                              <span className="font-semibold text-stone-700">
                                Total{" "}
                                <span className="font-bold">
                                  {fromCents(total)}
                                </span>
                              </span>
                              <span className="text-stone-200">|</span>
                              <span
                                className={`font-bold ${balanced ? "text-emerald-600" : "text-red-600"}`}
                              >
                                Saldo{" "}
                                {saldo >= 0
                                  ? fromCents(saldo)
                                  : `−${fromCents(Math.abs(saldo))}`}
                              </span>
                            </div>
                          </div>
                        );
                      })()}

                    {/* Add line button */}
                    {!showAddLine && (
                      <button
                        onClick={() => setShowAddLine(true)}
                        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-stone-300 py-2 text-xs font-medium text-stone-500 hover:border-[#ED5C32] hover:text-[#ED5C32]"
                      >
                        <span className="text-base leading-none">+</span>{" "}
                        Adicionar linha
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

                    {/* Lines list */}
                    {loadingLines ? (
                      <p className="text-sm text-stone-400">
                        A carregar linhas…
                      </p>
                    ) : lines.length === 0 ? (
                      <p className="text-sm text-stone-400">
                        Sem linhas registadas.
                      </p>
                    ) : (
                      lines.map((line) => {
                        const cc = line.costCenterCategoryId
                          ? ccMap.get(line.costCenterCategoryId)
                          : null;
                        const ccGroup = cc
                          ? groups.find((g) => g.id === cc.groupId)
                          : null;
                        const isEditingThisLine = editingLineId === line.id;
                        const isClassifyingThisLine =
                          classifyingLineId === line.id;
                        const isExpanded =
                          isEditingThisLine || isClassifyingThisLine;
                        const totalWithoutVat =
                          line.totalWithVat - line.vatAmount;
                        return (
                          <div
                            key={line.id}
                            className="space-y-1.5 rounded-lg border border-stone-200 bg-white p-3"
                          >
                            {/* Linha 1: nome + botão */}
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-semibold text-stone-800">
                                {line.description}
                              </p>
                              {isExpanded ? (
                                <div className="flex items-center gap-3">
                                  <button
                                    onClick={() =>
                                      setConfirmDeleteLineId(line.id)
                                    }
                                    className="shrink-0 text-xs text-red-400 hover:text-red-600"
                                  >
                                    Eliminar
                                  </button>
                                  <button
                                    onClick={() => {
                                      setEditingLineId(null);
                                      setClassifyingLineId(null);
                                    }}
                                    className="shrink-0 text-xs text-stone-400 hover:text-stone-600"
                                  >
                                    Cancelar
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => {
                                    setEditingLineId(line.id);
                                    setClassifyingLineId(line.id);
                                  }}
                                  className="shrink-0 text-xs font-medium text-[#ED5C32] hover:underline"
                                >
                                  Editar
                                </button>
                              )}
                            </div>

                            {/* Info read-only */}
                            {!isExpanded && (
                              <>
                                {/* Linha 2: valores */}
                                <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-stone-500">
                                  <span>
                                    Qtd:{" "}
                                    <span className="font-medium text-stone-700">
                                      {line.quantity}
                                      {line.unit ? ` ${line.unit}` : ""}
                                    </span>
                                  </span>
                                  <span>
                                    Un s/IVA:{" "}
                                    <span className="font-medium text-stone-700">
                                      {fromCents(line.unitCostWithoutVat)}
                                    </span>
                                  </span>
                                  <span>
                                    IVA:{" "}
                                    <span className="font-medium text-stone-700">
                                      {line.vatRate}%
                                    </span>
                                  </span>
                                  <span>
                                    Total s/IVA:{" "}
                                    <span className="font-medium text-stone-700">
                                      {fromCents(totalWithoutVat)}
                                    </span>
                                  </span>
                                  <span>
                                    IVA Total:{" "}
                                    <span className="font-medium text-stone-700">
                                      {fromCents(line.vatAmount)}
                                    </span>
                                  </span>
                                  <span>
                                    Total:{" "}
                                    <span className="font-semibold text-stone-800">
                                      {fromCents(line.totalWithVat)}
                                    </span>
                                  </span>
                                </div>

                                {/* Linha 3: tipo (esquerda) + classificação (direita) */}
                                <div className="flex items-center justify-between gap-2 text-xs">
                                  <span className="shrink-0 rounded-full bg-stone-100 px-2 py-0.5 text-stone-600">
                                    {INVOICE_LINE_TYPE_LABELS[line.type]}
                                  </span>
                                  {cc ? (
                                    <div className="flex items-center gap-2 text-stone-500">
                                      {ccGroup && <span>{ccGroup.name}</span>}
                                      <span className="font-medium text-stone-700">
                                        {cc.code} — {cc.name}
                                      </span>
                                      {cc.financialType && (
                                        <span
                                          className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${FINANCIAL_TYPE_COLORS[cc.financialType as FinancialType] ?? "bg-stone-100 text-stone-500"}`}
                                        >
                                          {FINANCIAL_TYPE_LABELS[
                                            cc.financialType as FinancialType
                                          ] ?? cc.financialType}
                                        </span>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="italic text-stone-400">
                                      Sem classificação
                                    </span>
                                  )}
                                </div>
                              </>
                            )}

                            {/* Formulários — apenas quando expandido */}
                            {isEditingThisLine && (
                              <EditLineForm
                                line={line}
                                invoiceId={invoice.id}
                                categories={categories}
                                onDone={(updated) => {
                                  handleLineUpdated(updated);
                                  setEditingLineId(null);
                                  setClassifyingLineId(null);
                                }}
                                onCancel={() => {
                                  setEditingLineId(null);
                                  setClassifyingLineId(null);
                                }}
                              />
                            )}
                          </div>
                        );
                      })
                    )}

                    {/* Impacto + botão — sempre visível */}
                    {!loadingLines &&
                      (() => {
                        const affectsDre = lines.some((l) => l.affectsDre);
                        const affectsCashflow = lines.some(
                          (l) => l.affectsCashflow,
                        );
                        const affectsProfitability = lines.some(
                          (l) => l.affectsProfitability,
                        );
                        return (
                          <div className="space-y-3">
                            {/* Impacto financeiro derivado das linhas */}
                            <div className="flex items-center justify-between rounded-lg border border-stone-100 bg-stone-50 px-4 py-2.5">
                              <p className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-stone-400">
                                Impacto financeiro
                              </p>
                              <div className="flex items-center gap-1.5">
                                {[
                                  { label: "DRE", value: affectsDre },
                                  {
                                    label: "Fluxo de Caixa",
                                    value: affectsCashflow,
                                  },
                                  {
                                    label: "Rentabilidade",
                                    value: affectsProfitability,
                                  },
                                ].map(({ label, value }, i, arr) => (
                                  <span
                                    key={label}
                                    className="flex items-center gap-1 text-xs"
                                  >
                                    <span className="text-stone-500">
                                      {label}:
                                    </span>
                                    <span
                                      className={`font-semibold ${value ? "text-teal-600" : "text-stone-400"}`}
                                    >
                                      {value ? "Sim" : "Não"}
                                    </span>
                                    {i < arr.length - 1 && (
                                      <span className="ml-1.5 text-stone-200">
                                        |
                                      </span>
                                    )}
                                  </span>
                                ))}
                              </div>
                            </div>

                            {/* Botão desativar detalhamento */}
                            <div className="flex justify-end">
                              <button
                                onClick={handleLineModeToggleClick}
                                disabled={settingLineMode === "loading"}
                                className="rounded-lg border border-[#ED5C32] px-4 py-3 text-xs font-medium text-[#ED5C32] hover:bg-[#ED5C32]/5 disabled:opacity-50"
                              >
                                {settingLineMode === "loading"
                                  ? "A desativar…"
                                  : "Desativar detalhamento por linhas"}
                              </button>
                            </div>
                          </div>
                        );
                      })()}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Modal de confirmação: detailed → simple */}
          {confirmDeleteLineId && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
              <div className="mx-4 w-full max-w-sm rounded-xl border border-stone-200 bg-white p-6 shadow-xl">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                  <svg
                    className="h-5 w-5 text-red-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </div>
                <h3 className="mb-1 text-sm font-semibold text-stone-800">
                  Eliminar linha?
                </h3>
                <p className="mb-5 text-sm text-stone-500">
                  Esta linha será apagada permanentemente e não pode ser
                  recuperada.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setConfirmDeleteLineId(null)}
                    className="flex-1 rounded-lg border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-50"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => {
                      const id = confirmDeleteLineId;
                      setConfirmDeleteLineId(null);
                      void handleLineDeleted(id);
                    }}
                    className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            </div>
          )}

          {showSimpleConfirm && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
              <div className="mx-4 w-full max-w-sm rounded-xl border border-stone-200 bg-white p-6 shadow-xl">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
                  <svg
                    className="h-5 w-5 text-amber-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                    />
                  </svg>
                </div>
                <h3 className="mb-1 text-sm font-semibold text-stone-800">
                  Voltar ao modo resumo?
                </h3>
                <p className="mb-5 text-sm text-stone-500">
                  As{" "}
                  <span className="font-medium text-stone-700">
                    {lines.length} {lines.length === 1 ? "linha" : "linhas"}
                  </span>{" "}
                  do modo detalhado serão apagadas permanentemente. Pode voltar
                  ao modo detalhado quando quiser e recomeçar do zero.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowSimpleConfirm(false)}
                    className="flex-1 rounded-lg border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-50"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => {
                      setShowSimpleConfirm(false);
                      void handleToggleLineDetailMode("simple");
                    }}
                    className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                  >
                    Apagar e simplificar
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
        {/* end left column */}

        {/* Inline PDF panel — right side, full height from header */}
        {showPdf && invoice.attachmentUrl && (
          <div className="flex w-[580px] shrink-0 flex-col border-l border-[#F5C992]/40">
            <div className="flex items-center justify-between border-b border-[#F5C992]/40 px-4 py-2">
              <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide">
                Documento original
              </p>
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

      {showUndoPaidConfirm && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          aria-modal="true"
        >
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowUndoPaidConfirm(false)}
          />
          <div className="relative w-full max-w-sm rounded-xl bg-white shadow-2xl p-6 flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <h3 className="text-base font-bold text-stone-900">
                Desfazer pagamento
              </h3>
              <p className="text-sm text-stone-500">
                A fatura vai voltar ao estado{" "}
                <span className="font-medium text-stone-700">Pendente</span> e o
                pagamento registado será removido. Esta ação não pode ser
                desfeita.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowUndoPaidConfirm(false)}
                className="flex-1 rounded-md border border-stone-300 px-3 py-2 text-sm font-medium text-stone-600 hover:bg-stone-50"
              >
                Cancelar
              </button>
              <button
                disabled={undoingPaid}
                onClick={async () => {
                  setUndoingPaid(true);
                  try {
                    const updated = await api.setInvoiceStatus(
                      invoice.id,
                      "pending",
                    );
                    setShowUndoPaidConfirm(false);
                    onInvoiceUpdated?.(updated);
                    qc.invalidateQueries({ queryKey: ["invoices"] });
                  } finally {
                    setUndoingPaid(false);
                  }
                }}
                className="flex-1 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-100 disabled:opacity-50"
              >
                {undoingPaid ? "A desfazer…" : "Desfazer pagamento"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body,
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
  locationId: string | null;
}

function emptyLineBuilder(): LineBuilder {
  return {
    description: "",
    type: "other",
    quantity: "1",
    unit: "",
    unitCost: "",
    vatRate: "23",
    catId: "",
    locationId: null,
  };
}

function lineBuilderToPayload(b: LineBuilder): CreateInvoiceLinePayload {
  const unitCostEur = parseFloat(b.unitCost || "0");
  const subtotal = parseFloat(b.quantity || "0") * unitCostEur;
  const vatAmount = Math.round(subtotal * (parseFloat(b.vatRate) / 100) * 100);
  const payload: CreateInvoiceLinePayload = {
    description: b.description,
    type: b.type,
    quantity: parseFloat(b.quantity),
    unitCostWithoutVat: Math.round(unitCostEur * 100),
    vatRate: parseFloat(b.vatRate),
    vatAmount,
    totalWithVat: Math.round(subtotal * 100) + vatAmount,
    // Optional (D4): omitted means "organization-wide, no store". Never defaulted.
    locationId: b.locationId,
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

  const lbSubtotal =
    parseFloat(lineBuilder.quantity || "0") *
    parseFloat(lineBuilder.unitCost || "0");
  const lbTotal =
    Math.round(lbSubtotal * 100) +
    Math.round(lbSubtotal * (parseFloat(lineBuilder.vatRate) / 100) * 100);

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
                  required
                  value={totalVat}
                  onChange={(e) => setTotalVat(e.target.value)}
                  className={inputCls}
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className={labelCls}>Total c/ IVA (€)</label>
                <NumericInput
                  required
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
                <label className="text-xs font-medium text-stone-500">
                  Linhas
                </label>
                <span className="text-xs text-stone-400">
                  {lines.length} linha{lines.length !== 1 ? "s" : ""}
                </span>
              </div>

              {/* Added lines list */}
              {lines.length > 0 && (
                <ul className="space-y-1">
                  {lines.map((l, i) => (
                    <li
                      key={i}
                      className="flex items-center justify-between rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-xs"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium text-stone-700">
                          {l.description}
                        </p>
                        <p className="text-stone-400">
                          {INVOICE_LINE_TYPE_LABELS[l.type ?? "other"]} ·{" "}
                          {(l.totalWithVat / 100).toLocaleString("pt-PT", {
                            style: "currency",
                            currency: "EUR",
                          })}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveLine(i)}
                        className="ml-2 shrink-0 text-stone-400 hover:text-red-500"
                      >
                        <svg
                          className="h-3.5 w-3.5"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
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
                    onChange={(e) =>
                      setLineBuilder((b) => ({
                        ...b,
                        description: e.target.value,
                      }))
                    }
                    placeholder="Descrição *"
                    className={inputSmCls}
                  />
                  <select
                    value={lineBuilder.type}
                    onChange={(e) =>
                      setLineBuilder((b) => ({
                        ...b,
                        type: e.target.value as InvoiceLineType,
                      }))
                    }
                    className={inputSmCls}
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
                  <div className="grid grid-cols-2 gap-2">
                    <NumericInput
                      decimals={3}
                      value={lineBuilder.quantity}
                      onChange={(e) =>
                        setLineBuilder((b) => ({
                          ...b,
                          quantity: e.target.value,
                        }))
                      }
                      placeholder="Qtd *"
                      className={inputSmCls}
                    />
                    <input
                      type="text"
                      value={lineBuilder.unit}
                      onChange={(e) =>
                        setLineBuilder((b) => ({ ...b, unit: e.target.value }))
                      }
                      placeholder="Unidade"
                      className={inputSmCls}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <NumericInput
                      value={lineBuilder.unitCost}
                      onChange={(e) =>
                        setLineBuilder((b) => ({
                          ...b,
                          unitCost: e.target.value,
                        }))
                      }
                      placeholder="Preço s/ IVA (€) *"
                      className={inputSmCls}
                    />
                    <select
                      value={lineBuilder.vatRate}
                      onChange={(e) =>
                        setLineBuilder((b) => ({
                          ...b,
                          vatRate: e.target.value,
                        }))
                      }
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
                    onChange={(e) =>
                      setLineBuilder((b) => ({ ...b, catId: e.target.value }))
                    }
                    className={inputSmCls}
                  >
                    <option value="">Subcategoria CC</option>
                    {categories
                      .filter((c) => c.isActive)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.code} — {c.name}
                        </option>
                      ))}
                  </select>
                  {/* Store (D4): optional — a cost may belong to the whole organization and to no store */}
                  <LocationSelect
                    value={lineBuilder.locationId}
                    onChange={(locationId) =>
                      setLineBuilder((b) => ({ ...b, locationId }))
                    }
                    allowUnset
                    className={inputSmCls}
                  />
                  {lbSubtotal > 0 && (
                    <p className="text-xs text-stone-500 tabular-nums">
                      Total c/ IVA:{" "}
                      <span className="font-semibold text-stone-800">
                        {(lbTotal / 100).toLocaleString("pt-PT", {
                          style: "currency",
                          currency: "EUR",
                        })}
                      </span>
                    </p>
                  )}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setAddingLine(false);
                        setLineBuilder(emptyLineBuilder());
                      }}
                      className="flex-1 rounded-md border border-stone-300 px-2 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleAddLine}
                      disabled={
                        !lineBuilder.description || !lineBuilder.unitCost
                      }
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
                  <span className="text-base leading-none">+</span> Adicionar
                  linha
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
    document.body,
  );
}

// ── Invoice Calendar View ──────────────────────────────────────────────────────

const MONTH_NAMES_PT = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];
const DOW_NAMES_PT = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

const STATUS_CHIP_BG: Record<InvoiceStatus, string> = {
  draft_ai: "#f5f5f4",
  pending_review: "#faf5ff",
  pending: "#fffbeb",
  paid: "#f0fdf4",
  overdue: "#fef2f2",
  cancelled: "#f5f5f4",
  review: "#faf5ff",
};

interface InvoiceCalendarViewProps {
  invoicesByDate: Map<string, InvoiceDTO[]>;
  noDueDateInvoices: InvoiceDTO[];
  month: Date;
  selectedDay: string | null;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
  onDayClick: (dateStr: string, invoices: InvoiceDTO[]) => void;
}

function InvoiceCalendarView({
  invoicesByDate,
  noDueDateInvoices,
  month,
  selectedDay,
  onPrevMonth,
  onNextMonth,
  onToday,
  onDayClick,
}: InvoiceCalendarViewProps) {
  const year = month.getFullYear();
  const monthIdx = month.getMonth();

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  const firstDayDow = (new Date(year, monthIdx, 1).getDay() + 6) % 7; // Mon=0
  const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...(Array(firstDayDow).fill(null) as null[]),
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
                <path
                  fillRule="evenodd"
                  d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z"
                  clipRule="evenodd"
                />
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
                <path
                  fillRule="evenodd"
                  d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
                  clipRule="evenodd"
                />
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
            <div
              key={d}
              className="py-2 text-center text-xs font-semibold text-stone-400"
            >
              {d}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 divide-x divide-y divide-[#F5C992]/20">
          {cells.map((day, i) => {
            if (day === null) {
              return (
                <div
                  key={`pad-${i}`}
                  className="min-h-[110px] bg-stone-50/30"
                />
              );
            }
            const dateStr = `${year}-${String(monthIdx + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const dayInvs = invoicesByDate.get(dateStr) ?? [];
            const isToday = dateStr === todayStr;
            const isSelected = dateStr === selectedDay;
            const hasOverdue = dayInvs.some((inv) => inv.status === "overdue");
            const visible = dayInvs.slice(0, 3);
            const extra = dayInvs.length - visible.length;

            return (
              <div
                key={dateStr}
                onClick={() =>
                  dayInvs.length > 0 && onDayClick(dateStr, dayInvs)
                }
                className={`min-h-[110px] p-1.5 transition-colors ${
                  dayInvs.length > 0 ? "cursor-pointer hover:bg-stone-50" : ""
                } ${isToday ? "bg-orange-50/50" : ""} ${
                  isSelected ? "ring-2 ring-inset ring-[#ED5C32]" : ""
                }`}
              >
                <div className="mb-1 flex justify-end">
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                      isToday
                        ? "bg-[#ED5C32] text-white"
                        : isSelected
                          ? "bg-stone-800 text-white"
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
                    <div
                      key={inv.id}
                      title={`${inv.supplierName} · ${fromCents(inv.totalWithVat)}`}
                      className="flex w-full items-center gap-1 rounded px-1.5 py-0.5"
                      style={{ backgroundColor: STATUS_CHIP_BG[inv.status] }}
                    >
                      <span
                        className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${STATUS_DOT[inv.status]}`}
                      />
                      <span className="min-w-0 truncate text-[10px] font-medium leading-tight text-stone-700">
                        {inv.supplierName}
                      </span>
                    </div>
                  ))}
                  {extra > 0 && (
                    <p className="pl-1 text-[9px] font-medium text-stone-400">
                      +{extra} mais
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-[#F5C992]/30 bg-stone-50/40 px-4 py-2.5">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-stone-400">
            Legenda
          </span>
          {[
            { dot: "bg-red-500", label: "Em atraso" },
            { dot: "bg-amber-500", label: "Pendente" },
            { dot: "bg-emerald-500", label: "Paga" },
            { dot: "bg-violet-500", label: "Ag. conciliação" },
          ].map(({ dot, label }) => (
            <span
              key={label}
              className="flex items-center gap-1.5 text-[10px] text-stone-500"
            >
              <span className={`h-2 w-2 rounded-full ${dot}`} />
              {label}
            </span>
          ))}
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
              <span
                key={inv.id}
                className="flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-2.5 py-1 text-xs font-medium text-stone-600"
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[inv.status]}`}
                />
                {inv.supplierName}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Calendar Day Panel ─────────────────────────────────────────────────────────

const DOW_LONG_PT = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];
const MONTH_LONG_PT = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

function formatDayHeader(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dow = new Date(y, m - 1, d).getDay();
  return `${DOW_LONG_PT[dow]}, ${d} de ${MONTH_LONG_PT[m - 1]} de ${y}`;
}

interface CalendarDayGroup {
  label: string;
  dotCls: string;
  headerCls: string;
  countCls: string;
  invoices: InvoiceDTO[];
}

interface CalendarDayPanelProps {
  dateStr: string;
  invoices: InvoiceDTO[];
  onClose: () => void;
  onView: (inv: InvoiceDTO) => void;
  onPay: (inv: InvoiceDTO) => void;
}

function CalendarDayPanel({
  dateStr,
  invoices,
  onClose,
  onView,
  onPay,
}: CalendarDayPanelProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const groups: CalendarDayGroup[] = [
    {
      label: "Em atraso",
      dotCls: "bg-red-500",
      headerCls: "text-red-700",
      countCls: "bg-red-100 text-red-700",
      invoices: invoices.filter((inv) => inv.status === "overdue"),
    },
    {
      label: "Pendentes",
      dotCls: "bg-amber-500",
      headerCls: "text-amber-700",
      countCls: "bg-amber-100 text-amber-700",
      invoices: invoices.filter((inv) =>
        ["pending", "pending_review", "review", "draft_ai"].includes(
          inv.status,
        ),
      ),
    },
    {
      label: "Aguardando conciliação",
      dotCls: "bg-violet-500",
      headerCls: "text-violet-700",
      countCls: "bg-violet-100 text-violet-700",
      invoices: invoices.filter(
        (inv) =>
          inv.status === "paid" &&
          inv.reconciliationStatus === "pending_reconciliation",
      ),
    },
    {
      label: "Pagas",
      dotCls: "bg-emerald-500",
      headerCls: "text-emerald-700",
      countCls: "bg-emerald-100 text-emerald-700",
      invoices: invoices.filter(
        (inv) =>
          inv.status === "paid" &&
          inv.reconciliationStatus !== "pending_reconciliation",
      ),
    },
  ].filter((g) => g.invoices.length > 0);

  const totalAmount = invoices.reduce((s, i) => s + i.totalWithVat, 0);
  const pendingAmount = invoices
    .filter((i) => i.status === "pending")
    .reduce((s, i) => s + i.totalWithVat, 0);
  const overdueAmount = invoices
    .filter((i) => i.status === "overdue")
    .reduce((s, i) => s + i.totalWithVat, 0);

  function toggleGroup(label: string) {
    setCollapsed((prev) => ({ ...prev, [label]: !prev[label] }));
  }

  return (
    <div className="flex w-full flex-col overflow-hidden rounded-xl border border-[#F5C992]/40 bg-white">
      {/* Header */}
      <div className="flex items-start justify-between border-b border-[#F5C992]/30 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-stone-800">
            {formatDayHeader(dateStr)}
          </p>
          <p className="mt-0.5 text-xs text-stone-400">
            {invoices.length} fatura{invoices.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={onClose}
          className="mt-0.5 rounded-md p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-600"
        >
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
          </svg>
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 divide-x divide-[#F5C992]/30 border-b border-[#F5C992]/30 bg-stone-50/40">
        <div className="px-3 py-2.5 text-center">
          <p className="text-[10px] font-medium uppercase tracking-wide text-stone-400">
            Total
          </p>
          <p className="mt-0.5 text-sm font-bold text-stone-800">
            {fromCents(totalAmount)}
          </p>
        </div>
        <div className="px-3 py-2.5 text-center">
          <p className="text-[10px] font-medium uppercase tracking-wide text-stone-400">
            Pendente
          </p>
          <p className="mt-0.5 text-sm font-bold text-amber-600">
            {fromCents(pendingAmount)}
          </p>
        </div>
        <div className="px-3 py-2.5 text-center">
          <p className="text-[10px] font-medium uppercase tracking-wide text-stone-400">
            Em atraso
          </p>
          <p className="mt-0.5 text-sm font-bold text-red-600">
            {fromCents(overdueAmount)}
          </p>
        </div>
      </div>

      {/* Groups */}
      <div className="flex-1 overflow-y-auto">
        {groups.map((group) => (
          <div
            key={group.label}
            className="border-b border-[#F5C992]/20 last:border-0"
          >
            {/* Group header */}
            <button
              onClick={() => toggleGroup(group.label)}
              className="flex w-full items-center justify-between px-4 py-2.5 hover:bg-stone-50"
            >
              <span
                className={`flex items-center gap-2 text-xs font-semibold ${group.headerCls}`}
              >
                <span className={`h-2 w-2 rounded-full ${group.dotCls}`} />
                {group.label}
              </span>
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${group.countCls}`}
                >
                  {group.invoices.length}
                </span>
                <svg
                  className={`h-3.5 w-3.5 text-stone-400 transition-transform ${collapsed[group.label] ? "-rotate-90" : ""}`}
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
            </button>

            {/* Invoice rows */}
            {!collapsed[group.label] && (
              <div className="divide-y divide-stone-100">
                {group.invoices.map((inv) => (
                  <div key={inv.id} className="px-4 py-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-stone-800">
                          {inv.supplierName}
                        </p>
                        <p className="mt-0.5 text-[10px] text-stone-400">
                          {inv.invoiceNumber}
                        </p>
                        <p className="mt-0.5 text-[10px] text-stone-400">
                          <svg
                            className="mr-0.5 inline h-3 w-3"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                          >
                            <path
                              fillRule="evenodd"
                              d="M5.75 2a.75.75 0 01.75.75V4h7V2.75a.75.75 0 011.5 0V4h.25A2.75 2.75 0 0118 6.75v8.5A2.75 2.75 0 0115.25 18H4.75A2.75 2.75 0 012 15.25v-8.5A2.75 2.75 0 014.75 4H5V2.75A.75.75 0 015.75 2zm-1 5.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25v-6.5c0-.69-.56-1.25-1.25-1.25H4.75z"
                              clipRule="evenodd"
                            />
                          </svg>
                          Vencimento: {formatDate(inv.dueDate)}
                        </p>
                      </div>
                      <p className="shrink-0 text-sm font-bold text-stone-800">
                        {fromCents(inv.totalWithVat)}
                      </p>
                    </div>
                    {/* Actions */}
                    <div className="mt-2 flex items-center gap-1.5">
                      {!["paid", "cancelled"].includes(inv.status) && (
                        <button
                          onClick={() => onPay(inv)}
                          className="flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors"
                        >
                          <svg
                            className="h-3 w-3"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                          >
                            <path
                              fillRule="evenodd"
                              d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                              clipRule="evenodd"
                            />
                          </svg>
                          Pagar
                        </button>
                      )}
                      <button
                        onClick={() => onView(inv)}
                        className="flex items-center gap-1 rounded-md border border-stone-200 bg-white px-2 py-1 text-[10px] font-semibold text-stone-600 hover:bg-stone-50 transition-colors"
                      >
                        <svg
                          className="h-3 w-3"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
                          <path
                            fillRule="evenodd"
                            d="M.664 10.59a1.651 1.651 0 010-1.186A10.004 10.004 0 0110 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0110 17c-4.257 0-7.893-2.66-9.336-6.41z"
                            clipRule="evenodd"
                          />
                        </svg>
                        Ver
                      </button>
                      {inv.attachmentUrl && (
                        <a
                          href={inv.attachmentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 rounded-md border border-stone-200 bg-white px-2 py-1 text-[10px] font-semibold text-stone-600 hover:bg-stone-50 transition-colors"
                        >
                          <svg
                            className="h-3 w-3"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                          >
                            <path
                              fillRule="evenodd"
                              d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
                              clipRule="evenodd"
                            />
                          </svg>
                          PDF
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main View ──────────────────────────────────────────────────────────────────

export function InvoicesView() {
  const { api } = useInvoicesModule();
  const fbModule = useFinancialBaseModule();
  const { api: bankApi } = useBankAccountsModule();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [viewMode, setViewMode] = useState<"table" | "calendar">("table");
  const [calendarMonth, setCalendarMonth] = useState<Date>(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );
  const [selectedCalendarDay, setSelectedCalendarDay] = useState<{
    dateStr: string;
    invoices: InvoiceDTO[];
  } | null>(null);
  const [activeTab, setActiveTab] = useState<
    "por_pagar" | "aguardando_conciliacao" | "concluidas" | "todas"
  >("por_pagar");
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | "">("");
  const [accountFilter, setAccountFilter] = useState<string>("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [openRowMenu, setOpenRowMenu] = useState<{
    id: string;
    top: number;
    right: number;
  } | null>(null);
  const [monthFilter, setMonthFilter] = useState<string | null>(null);
  const [monthPickerYear, setMonthPickerYear] = useState(() =>
    new Date().getFullYear(),
  );
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [showFiltersPanel, setShowFiltersPanel] = useState(false);
  const [supplierFilter, setSupplierFilter] = useState<string>("");
  const [minAmount, setMinAmount] = useState<string>("");
  const [maxAmount, setMaxAmount] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [directDebitFilter, setDirectDebitFilter] = useState(false);
  const [dueDateFrom, setDueDateFrom] = useState<string>("");
  const [dueDateTo, setDueDateTo] = useState<string>("");
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [showCreate, setShowCreate] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importResult, setImportResult] =
    useState<InvoiceImportResultDTO | null>(null);
  const [detail, setDetail] = useState<InvoiceDTO | null>(null);
  const [markingPaidId, setMarkingPaidId] = useState<string | null>(null);
  const [markPaidInvoice, setMarkPaidInvoice] = useState<InvoiceDTO | null>(
    null,
  );
  const [deleteConfirmInvoice, setDeleteConfirmInvoice] =
    useState<InvoiceDTO | null>(null);

  // Data
  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["invoices", statusFilter],
    queryFn: () =>
      api.listInvoices(statusFilter ? { status: statusFilter } : undefined),
  });

  useQuery({
    queryKey: ["invoice-alerts"],
    queryFn: () => api.getInvoiceAlerts(),
  });

  const { data: banks = [] } = useQuery({
    queryKey: ["banks"],
    queryFn: () => bankApi.listBanks(),
  });

  const bankAccounts = useMemo(() => {
    const result: { id: string; label: string }[] = [];
    for (const bank of banks) {
      for (const acc of bank.accountPreviews) {
        if (acc.isActive) {
          const name = acc.nickname ?? acc.label;
          result.push({
            id: acc.id,
            label: acc.lastFourDigits
              ? `${name} (${bank.name}) •••• ${acc.lastFourDigits}`
              : `${name} (${bank.name})`,
          });
        }
      }
    }
    return result;
  }, [banks]);

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
        (i) =>
          !i.dueDate && !i.paidAt && !["paid", "cancelled"].includes(i.status),
      ),
    [invoices],
  );

  const selectedCalendarDayInvoices = useMemo(() => {
    if (!selectedCalendarDay) return null;
    return invoicesByDueDate.get(selectedCalendarDay.dateStr) ?? null;
  }, [selectedCalendarDay, invoicesByDueDate]);

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

  async function handleMarkPaid(
    id: string,
    paidAt?: string,
    bankAccountId?: string,
    paymentMethod?: string,
    paymentNotes?: string,
  ) {
    setMarkingPaidId(id);
    try {
      const updated = await api.markInvoicePaid(
        id,
        paidAt,
        bankAccountId ?? null,
        paymentMethod ?? null,
        paymentNotes ?? null,
      );
      void qc.invalidateQueries({ queryKey: ["invoices"] });
      void qc.invalidateQueries({ queryKey: ["invoice-alerts"] });
      void qc.invalidateQueries({ queryKey: ["payable-entries"] });
      if (detail?.id === id) setDetail(updated);
      setMarkPaidInvoice(null);
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

  const activeAdvancedCount = [
    supplierFilter,
    minAmount,
    maxAmount,
    categoryFilter,
    directDebitFilter,
    dueDateFrom,
    dueDateTo,
  ].filter(Boolean).length;

  function clearAdvancedFilters() {
    setSupplierFilter("");
    setMinAmount("");
    setMaxAmount("");
    setCategoryFilter("");
    setDirectDebitFilter(false);
    setDueDateFrom("");
    setDueDateTo("");
    setPage(1);
  }

  // Filtered by search + account + month + advanced
  const filtered = useMemo(() => {
    let result = invoices;
    if (accountFilter)
      result = result.filter(
        (inv) => inv.paymentBankAccountId === accountFilter,
      );
    if (monthFilter) {
      result = result.filter((inv) => {
        const date = inv.invoiceDate ?? inv.dueDate ?? inv.paidAt;
        return date ? date.startsWith(monthFilter) : false;
      });
    }
    if (supplierFilter)
      result = result.filter((inv) => inv.supplierId === supplierFilter);
    if (minAmount)
      result = result.filter(
        (inv) => inv.totalWithVat >= parseFloat(minAmount) * 100,
      );
    if (maxAmount)
      result = result.filter(
        (inv) => inv.totalWithVat <= parseFloat(maxAmount) * 100,
      );
    if (categoryFilter) {
      result = result.filter((inv) => {
        const sup = inv.supplierId ? supplierById.get(inv.supplierId) : null;
        return sup?.defaultCostCenterCategoryId === categoryFilter;
      });
    }
    if (directDebitFilter) result = result.filter((inv) => inv.isDirectDebit);
    if (dueDateFrom)
      result = result.filter(
        (inv) => !!inv.dueDate && inv.dueDate >= dueDateFrom,
      );
    if (dueDateTo)
      result = result.filter(
        (inv) => !!inv.dueDate && inv.dueDate <= dueDateTo,
      );
    if (!search) return result;
    const q = search.toLowerCase();
    return result.filter(
      (inv) =>
        inv.supplierName.toLowerCase().includes(q) ||
        inv.invoiceNumber.toLowerCase().includes(q),
    );
  }, [
    invoices,
    search,
    accountFilter,
    monthFilter,
    supplierFilter,
    minAmount,
    maxAmount,
    categoryFilter,
    directDebitFilter,
    dueDateFrom,
    dueDateTo,
    supplierById,
  ]);

  // Tab counts
  const tabCounts = useMemo(
    () => ({
      por_pagar: filtered.filter(
        (i) =>
          [
            "pending",
            "overdue",
            "draft_ai",
            "pending_review",
            "review",
          ].includes(i.status) &&
          i.reconciliationStatus !== "pending_reconciliation",
      ).length,
      aguardando_conciliacao: filtered.filter(
        (i) => i.reconciliationStatus === "pending_reconciliation",
      ).length,
      concluidas: filtered.filter(
        (i) =>
          ["paid", "cancelled"].includes(i.status) &&
          i.reconciliationStatus !== "pending_reconciliation",
      ).length,
      todas: filtered.length,
    }),
    [filtered],
  );

  const tabFiltered = useMemo(() => {
    switch (activeTab) {
      case "por_pagar":
        return filtered.filter(
          (i) =>
            [
              "pending",
              "overdue",
              "draft_ai",
              "pending_review",
              "review",
            ].includes(i.status) &&
            i.reconciliationStatus !== "pending_reconciliation",
        );
      case "aguardando_conciliacao":
        return filtered.filter(
          (i) => i.reconciliationStatus === "pending_reconciliation",
        );
      case "concluidas":
        return filtered.filter(
          (i) =>
            ["paid", "cancelled"].includes(i.status) &&
            i.reconciliationStatus !== "pending_reconciliation",
        );
      default:
        return filtered;
    }
  }, [filtered, activeTab]);

  function handleTabChange(tab: typeof activeTab) {
    setActiveTab(tab);
    setPage(1);
    setSelectedIds(new Set());
    setStatusFilter("");
  }

  // Pagination
  const totalPages = Math.ceil(tabFiltered.length / pageSize);
  const paginated = tabFiltered.slice((page - 1) * pageSize, page * pageSize);

  // Today string for due-date urgency
  const todayStr = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();

  return (
    <div className="min-h-screen bg-[#FAF6F3]">
      {/* Header */}
      <div className="border-b border-[#F5C992]/40 bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-stone-900">Faturas</h1>
            <p className="mt-0.5 hidden sm:block text-sm text-stone-500">
              Gestão de faturas e documentos de fornecedores
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* View mode toggle */}
            <div className="flex rounded-md border border-stone-200 bg-stone-50 p-0.5">
              <button
                onClick={() => {
                  setViewMode("table");
                  setSelectedCalendarDay(null);
                }}
                title="Vista tabela"
                className={`flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium transition-colors sm:px-3 ${
                  viewMode === "table"
                    ? "bg-white text-stone-800 shadow-sm"
                    : "text-stone-500 hover:text-stone-700"
                }`}
              >
                <svg
                  className="h-3.5 w-3.5 shrink-0"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M.99 5.24A2.25 2.25 0 013.25 3h13.5A2.25 2.25 0 0119 5.25l.01 9.5A2.25 2.25 0 0116.76 17H3.26A2.272 2.272 0 011 14.75l-.01-9.51zm8.26 9.52v-.625a.75.75 0 00-.75-.75H3.25a.75.75 0 00-.75.75v.615c0 .414.336.75.75.75h5.373a.75.75 0 00.627-.74zm1.5 0a.75.75 0 00.627.74h5.373a.75.75 0 00.75-.75v-.615a.75.75 0 00-.75-.75H11.5a.75.75 0 00-.75.75v.625zm6.75-3.63v-.625a.75.75 0 00-.75-.75H11.5a.75.75 0 00-.75.75v.625c0 .414.336.75.75.75h5.25a.75.75 0 00.75-.75zm-8.25 0v-.625a.75.75 0 00-.75-.75H3.25a.75.75 0 00-.75.75v.625c0 .414.336.75.75.75H8.5a.75.75 0 00.75-.75zM17.5 7.5v-.625a.75.75 0 00-.75-.75H11.5a.75.75 0 00-.75.75V7.5c0 .414.336.75.75.75h5.25a.75.75 0 00.75-.75zm-8.25 0v-.625a.75.75 0 00-.75-.75H3.25a.75.75 0 00-.75.75V7.5c0 .414.336.75.75.75H8.5a.75.75 0 00.75-.75z"
                    clipRule="evenodd"
                  />
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
                <svg
                  className="h-3.5 w-3.5 shrink-0"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M5.75 2a.75.75 0 01.75.75V4h7V2.75a.75.75 0 011.5 0V4h.25A2.75 2.75 0 0118 6.75v8.5A2.75 2.75 0 0115.25 18H4.75A2.75 2.75 0 012 15.25v-8.5A2.75 2.75 0 014.75 4H5V2.75A.75.75 0 015.75 2zm-1 5.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25v-6.5c0-.69-.56-1.25-1.25-1.25H4.75z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="hidden sm:inline">Calendário</span>
              </button>
            </div>

            <div className="h-6 w-px bg-stone-200" />

            <button
              onClick={() => setShowImport(true)}
              className="flex items-center gap-2 rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 sm:px-4"
            >
              <svg
                className="h-4 w-4 shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                />
              </svg>
              <span className="hidden sm:inline">Importar faturas</span>
            </button>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 rounded-md bg-gradient-to-r from-[#ED5C32] to-[#EF8935] px-3 py-2 text-sm font-medium text-white hover:opacity-90 sm:px-4"
            >
              <svg
                className="h-4 w-4 shrink-0"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
              </svg>
              <span className="hidden sm:inline">Nova fatura manual</span>
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-4 p-6">
        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <svg
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
                clipRule="evenodd"
              />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Pesquisar fornecedor, nº fatura, referência..."
              className="w-72 rounded-md border border-stone-300 bg-white pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-[#ED5C32]"
            />
          </div>
          {/* Status select */}
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as InvoiceStatus | "");
                setPage(1);
              }}
              className="appearance-none rounded-md border border-stone-300 bg-white py-2 pl-3 pr-8 text-sm text-stone-700 focus:outline-none focus:border-[#ED5C32]"
            >
              <option value="">Todos os estados</option>
              {(
                Object.entries(INVOICE_STATUS_LABELS) as [
                  InvoiceStatus,
                  string,
                ][]
              ).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            <svg
              className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                clipRule="evenodd"
              />
            </svg>
          </div>

          {/* Accounts select */}
          <div className="relative">
            <select
              value={accountFilter}
              onChange={(e) => {
                setAccountFilter(e.target.value);
                setPage(1);
              }}
              className="appearance-none rounded-md border border-stone-300 bg-white py-2 pl-3 pr-8 text-sm text-stone-700 focus:outline-none focus:border-[#ED5C32] w-40"
            >
              <option value="">Todas as contas</option>
              {bankAccounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.label}
                </option>
              ))}
            </select>
            <svg
              className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                clipRule="evenodd"
              />
            </svg>
          </div>

          {/* Month picker */}
          <div className="relative">
            <button
              onClick={() => setShowMonthPicker((v) => !v)}
              className="flex items-center gap-1.5 rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-700 select-none hover:bg-stone-50"
            >
              <svg
                className="h-4 w-4 shrink-0 text-stone-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M5.75 2a.75.75 0 01.75.75V4h7V2.75a.75.75 0 011.5 0V4h.25A2.75 2.75 0 0118 6.75v8.5A2.75 2.75 0 0115.25 18H4.75A2.75 2.75 0 012 15.25v-8.5A2.75 2.75 0 014.75 4H5V2.75A.75.75 0 015.75 2zm-1 5.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25v-6.5c0-.69-.56-1.25-1.25-1.25H4.75z"
                  clipRule="evenodd"
                />
              </svg>
              <span>
                {monthFilter
                  ? new Date(monthFilter + "-01").toLocaleDateString("pt-PT", {
                      month: "long",
                      year: "numeric",
                    })
                  : "Todos os meses"}
              </span>
              <svg
                className="h-4 w-4 text-stone-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
            {showMonthPicker && (
              <>
                <div
                  className="fixed inset-0 z-20"
                  onClick={() => setShowMonthPicker(false)}
                />
                <div className="absolute left-0 top-full z-30 mt-1 w-64 rounded-xl border border-stone-200 bg-white p-4 shadow-lg">
                  <div className="mb-3 flex items-center justify-between">
                    <button
                      onClick={() => setMonthPickerYear((y) => y - 1)}
                      className="rounded p-1 hover:bg-stone-100 text-stone-500"
                    >
                      <svg
                        className="h-4 w-4"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>
                    <span className="text-sm font-semibold text-stone-700">
                      {monthPickerYear}
                    </span>
                    <button
                      onClick={() => setMonthPickerYear((y) => y + 1)}
                      className="rounded p-1 hover:bg-stone-100 text-stone-500"
                    >
                      <svg
                        className="h-4 w-4"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    {Array.from({ length: 12 }, (_, i) => {
                      const key = `${monthPickerYear}-${String(i + 1).padStart(2, "0")}`;
                      const isActive = monthFilter === key;
                      return (
                        <button
                          key={key}
                          onClick={() => {
                            setMonthFilter(isActive ? null : key);
                            setShowMonthPicker(false);
                            setPage(1);
                          }}
                          className={`rounded-lg py-1.5 text-xs font-medium transition-colors ${
                            isActive
                              ? "bg-[#ED5C32] text-white"
                              : "text-stone-600 hover:bg-stone-100"
                          }`}
                        >
                          {new Date(monthPickerYear, i).toLocaleDateString(
                            "pt-PT",
                            { month: "short" },
                          )}
                        </button>
                      );
                    })}
                  </div>
                  {monthFilter && (
                    <button
                      onClick={() => {
                        setMonthFilter(null);
                        setShowMonthPicker(false);
                        setPage(1);
                      }}
                      className="mt-3 w-full rounded-lg border border-stone-200 py-1.5 text-xs font-medium text-stone-500 hover:bg-stone-50"
                    >
                      Limpar
                    </button>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Filtros button */}
          <button
            onClick={() => setShowFiltersPanel(true)}
            className={`relative flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium hover:bg-stone-50 ${
              activeAdvancedCount > 0
                ? "border-[#ED5C32] bg-[#ED5C32]/5 text-[#ED5C32]"
                : "border-stone-300 bg-white text-stone-700"
            }`}
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M2.628 1.601C5.028 1.206 7.49 1 10 1s4.973.206 7.372.601a.75.75 0 01.628.74v2.288a2.25 2.25 0 01-.659 1.59l-4.682 4.683a2.25 2.25 0 00-.659 1.59v3.037c0 .684-.31 1.33-.844 1.757l-1.937 1.55A.75.75 0 018 18.25v-5.757a2.25 2.25 0 00-.659-1.591L2.659 6.22A2.25 2.25 0 012 4.629V2.34a.75.75 0 01.628-.74z"
                clipRule="evenodd"
              />
            </svg>
            Filtros
            {activeAdvancedCount > 0 && (
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#ED5C32] text-[10px] font-bold text-white">
                {activeAdvancedCount}
              </span>
            )}
          </button>
        </div>

        {/* Filters panel — portal to escape overflow context */}
        {showFiltersPanel &&
          createPortal(
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 z-40 bg-black/20"
                onClick={() => setShowFiltersPanel(false)}
              />
              {/* Drawer */}
              <div className="fixed right-0 top-0 z-50 flex h-full w-80 flex-col bg-white shadow-xl">
                <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4">
                  <span className="text-sm font-semibold text-stone-800">
                    Filtros avançados
                  </span>
                  <button
                    onClick={() => setShowFiltersPanel(false)}
                    className="rounded p-1 hover:bg-stone-100 text-stone-500"
                  >
                    <svg
                      className="h-4 w-4"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                    </svg>
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
                  {/* Fornecedor */}
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-stone-600">
                      Fornecedor
                    </label>
                    <div className="relative">
                      <select
                        value={supplierFilter}
                        onChange={(e) => {
                          setSupplierFilter(e.target.value);
                          setPage(1);
                        }}
                        className="w-full appearance-none rounded-md border border-stone-300 bg-white py-2 pl-3 pr-8 text-sm text-stone-700 focus:outline-none focus:border-[#ED5C32]"
                      >
                        <option value="">Todos os fornecedores</option>
                        {suppliers.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                      <svg
                        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                  </div>

                  {/* Valor total */}
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-stone-600">
                      Intervalo de valor (€)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        placeholder="Mín"
                        value={minAmount}
                        onChange={(e) => {
                          setMinAmount(e.target.value);
                          setPage(1);
                        }}
                        className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:border-[#ED5C32]"
                      />
                      <span className="text-stone-400 text-sm">—</span>
                      <input
                        type="number"
                        placeholder="Máx"
                        value={maxAmount}
                        onChange={(e) => {
                          setMaxAmount(e.target.value);
                          setPage(1);
                        }}
                        className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:border-[#ED5C32]"
                      />
                    </div>
                  </div>

                  {/* Classificação */}
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-stone-600">
                      Classificação
                    </label>
                    <div className="relative">
                      <select
                        value={categoryFilter}
                        onChange={(e) => {
                          setCategoryFilter(e.target.value);
                          setPage(1);
                        }}
                        className="w-full appearance-none rounded-md border border-stone-300 bg-white py-2 pl-3 pr-8 text-sm text-stone-700 focus:outline-none focus:border-[#ED5C32]"
                      >
                        <option value="">Todas as classificações</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.code} — {c.name}
                          </option>
                        ))}
                      </select>
                      <svg
                        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                  </div>

                  {/* Data de vencimento */}
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-stone-600">
                      Data de vencimento
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="date"
                        value={dueDateFrom}
                        onChange={(e) => {
                          setDueDateFrom(e.target.value);
                          setPage(1);
                        }}
                        className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:border-[#ED5C32]"
                      />
                      <span className="text-stone-400 text-sm">—</span>
                      <input
                        type="date"
                        value={dueDateTo}
                        onChange={(e) => {
                          setDueDateTo(e.target.value);
                          setPage(1);
                        }}
                        className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:border-[#ED5C32]"
                      />
                    </div>
                  </div>

                  {/* Débito direto */}
                  <div className="flex items-center justify-between rounded-lg border border-stone-200 px-4 py-3">
                    <span className="text-sm text-stone-700">
                      Débito direto
                    </span>
                    <button
                      role="switch"
                      aria-checked={directDebitFilter}
                      onClick={() => {
                        setDirectDebitFilter((v) => !v);
                        setPage(1);
                      }}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                        directDebitFilter ? "bg-[#ED5C32]" : "bg-stone-200"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                          directDebitFilter ? "translate-x-4" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                </div>

                <div className="border-t border-stone-200 px-5 py-4 flex gap-3">
                  <button
                    onClick={() => {
                      clearAdvancedFilters();
                      setShowFiltersPanel(false);
                    }}
                    className="flex-1 rounded-md border border-stone-300 py-2 text-sm font-medium text-stone-600 hover:bg-stone-50"
                  >
                    Limpar
                  </button>
                  <button
                    onClick={() => setShowFiltersPanel(false)}
                    className="flex-1 rounded-md bg-gradient-to-r from-[#ED5C32] to-[#EF8935] py-2 text-sm font-medium text-white hover:opacity-90"
                  >
                    Aplicar
                  </button>
                </div>
              </div>
            </>,
            document.body,
          )}

        {/* Table container */}
        {viewMode === "table" && (
          <div className="overflow-hidden rounded-xl border border-[#F5C992]/40 bg-white">
            {/* Tabs */}
            <div className="flex border-b border-[#F5C992]/40 px-2 overflow-x-auto">
              {[
                { key: "por_pagar" as const, label: "Por pagar" },
                {
                  key: "aguardando_conciliacao" as const,
                  label: "Aguardando conciliação",
                },
                { key: "concluidas" as const, label: "Concluídas" },
                { key: "todas" as const, label: "Todas" },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => handleTabChange(key)}
                  className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
                    activeTab === key
                      ? "border-[#ED5C32] text-[#ED5C32]"
                      : "border-transparent text-stone-500 hover:text-stone-700"
                  }`}
                >
                  {label}
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-xs font-semibold tabular-nums ${
                      activeTab === key
                        ? "bg-[#ED5C32]/10 text-[#ED5C32]"
                        : "bg-stone-100 text-stone-500"
                    }`}
                  >
                    {tabCounts[key]}
                  </span>
                </button>
              ))}
            </div>

            {/* Batch action bar */}
            {selectedIds.size > 0 && (
              <div className="border-b border-[#F5C992]/40 bg-[#ED5C32]/5 px-4 py-2">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-medium text-stone-700">
                    {selectedIds.size} selecionada
                    {selectedIds.size !== 1 ? "s" : ""}
                  </span>
                  <button
                    onClick={() => {
                      const inv = paginated.find(
                        (i) =>
                          selectedIds.has(i.id) &&
                          (i.status === "pending" || i.status === "overdue"),
                      );
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
              </div>
            )}

            {isLoading ? (
              <div className="py-16 text-center text-sm text-stone-400">
                A carregar…
              </div>
            ) : paginated.length === 0 ? (
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
                          checked={
                            selectedIds.size > 0 &&
                            paginated.every((i) => selectedIds.has(i.id))
                          }
                          onChange={(e) => {
                            if (e.target.checked)
                              setSelectedIds(
                                new Set(paginated.map((i) => i.id)),
                              );
                            else setSelectedIds(new Set());
                          }}
                          className="h-3.5 w-3.5 rounded border-stone-300 text-[#ED5C32] focus:ring-[#ED5C32]"
                        />
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">
                        Fatura
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">
                        Fornecedor
                      </th>
                      {activeTab === "todas" && (
                        <th className="hidden md:table-cell px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">
                          Estado
                        </th>
                      )}
                      <th className="hidden md:table-cell px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">
                        Vencimento
                      </th>
                      <th className="hidden lg:table-cell px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">
                        Classificação
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-stone-500">
                        Valor total
                      </th>
                      <th className="sticky right-0 bg-stone-50/60 px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-stone-500 shadow-[-1px_0_0_0_rgba(245,201,146,0.4)]">
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F5C992]/30">
                    {paginated.map((inv) => {
                      const sup = inv.supplierId
                        ? supplierById.get(inv.supplierId)
                        : null;
                      const cat = sup?.defaultCostCenterCategoryId
                        ? categoryById.get(sup.defaultCostCenterCategoryId)
                        : null;
                      const dueUrgency = (() => {
                        if (
                          !inv.dueDate ||
                          ["paid", "cancelled"].includes(inv.status)
                        )
                          return null;
                        if (inv.dueDate < todayStr)
                          return {
                            label: "Em atraso",
                            cls: "text-red-600 font-medium",
                          };
                        if (inv.dueDate === todayStr)
                          return {
                            label: "Hoje",
                            cls: "text-orange-600 font-medium",
                          };
                        const diff = Math.round(
                          (new Date(inv.dueDate).getTime() -
                            new Date(todayStr).getTime()) /
                            86400000,
                        );
                        return {
                          label: `${diff} dias`,
                          cls: diff <= 7 ? "text-amber-600" : "text-stone-400",
                        };
                      })();

                      return (
                        <tr
                          key={inv.id}
                          className={`group cursor-pointer hover:bg-[#FDF8F5] ${selectedIds.has(inv.id) ? "bg-[#ED5C32]/5" : ""}`}
                          onClick={() => {
                            if (
                              inv.status === "draft_ai" ||
                              inv.status === "pending_review"
                            ) {
                              void handleRowReview(inv);
                            } else {
                              setDetail(inv);
                            }
                          }}
                        >
                          {/* Checkbox */}
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

                          {/* Fatura */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-stone-900">
                                {inv.invoiceNumber}
                              </p>
                              {inv.isDirectDebit && (
                                <span className="rounded px-1 py-0.5 text-[10px] font-bold uppercase tracking-wide bg-violet-100 text-violet-700">
                                  DD
                                </span>
                              )}
                            </div>
                            <p className="mt-0.5 text-xs text-stone-400">
                              {formatDate(inv.invoiceDate)}
                            </p>
                          </td>

                          {/* Fornecedor */}
                          <td className="px-4 py-3 text-stone-700">
                            {inv.supplierName}
                          </td>

                          {/* Estado — só na tab "Todas" */}
                          {activeTab === "todas" && (
                            <td className="hidden md:table-cell px-4 py-3">
                              <div className="flex flex-wrap items-center gap-1">
                                <StatusBadge status={inv.status} />
                                {inv.reconciliationStatus !== "none" && (
                                  <ReconciliationBadge
                                    status={inv.reconciliationStatus}
                                  />
                                )}
                              </div>
                            </td>
                          )}

                          {/* Vencimento */}
                          <td className="hidden md:table-cell px-4 py-3">
                            <p className="text-stone-700">
                              {formatDate(inv.dueDate)}
                            </p>
                            {dueUrgency && (
                              <p className={`mt-0.5 text-xs ${dueUrgency.cls}`}>
                                {dueUrgency.label}
                              </p>
                            )}
                          </td>

                          {/* Classificação */}
                          <td className="hidden lg:table-cell px-4 py-3">
                            {cat ? (
                              <span className="inline-flex items-center gap-1.5 text-sm text-stone-700">
                                <span className="h-2 w-2 shrink-0 rounded-full bg-stone-400" />
                                <span className="font-medium">{cat.code}</span>
                                <span className="text-stone-500">
                                  — {cat.name}
                                </span>
                              </span>
                            ) : (
                              <span className="text-stone-300 text-xs">—</span>
                            )}
                          </td>

                          {/* Valor total */}
                          <td className="px-4 py-3 text-right font-semibold text-stone-800">
                            {fromCents(inv.totalWithVat)}
                          </td>

                          {/* Ações */}
                          <td
                            className="sticky right-0 z-10 bg-white px-3 py-3 group-hover:bg-[#FDF8F5] shadow-[-1px_0_0_0_rgba(245,201,146,0.4)]"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => {
                                  if (inv.status === "draft_ai" || inv.status === "pending_review") {
                                    void handleRowReview(inv);
                                  } else {
                                    setDetail(inv);
                                  }
                                }}
                                className="flex items-center gap-1 rounded-md border border-stone-200 px-2 py-1.5 text-xs font-medium text-stone-500 hover:bg-stone-50 hover:text-stone-700"
                              >
                                Ver
                              </button>
                              {inv.attachmentUrl && (
                                <a
                                  href={inv.attachmentUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title="Ver PDF"
                                  className="flex items-center gap-1 rounded-md border border-stone-200 px-2 py-1.5 text-xs font-medium text-stone-500 hover:bg-stone-50 hover:text-stone-700"
                                >
                                  <svg
                                    className="h-3.5 w-3.5"
                                    viewBox="0 0 20 20"
                                    fill="currentColor"
                                  >
                                    <path
                                      fillRule="evenodd"
                                      d="M4.5 2A1.5 1.5 0 003 3.5v13A1.5 1.5 0 004.5 18h11a1.5 1.5 0 001.5-1.5V7.621a1.5 1.5 0 00-.44-1.06l-4.12-4.122A1.5 1.5 0 0011.378 2H4.5zm2.25 8.5a.75.75 0 000 1.5h6.5a.75.75 0 000-1.5h-6.5zm0 3a.75.75 0 000 1.5h6.5a.75.75 0 000-1.5h-6.5zm0-6a.75.75 0 000 1.5h3a.75.75 0 000-1.5h-3z"
                                      clipRule="evenodd"
                                    />
                                  </svg>
                                  PDF
                                </a>
                              )}
                              <button
                                onClick={(e) => {
                                  const rect = (
                                    e.currentTarget as HTMLButtonElement
                                  ).getBoundingClientRect();
                                  setOpenRowMenu((prev) =>
                                    prev?.id === inv.id
                                      ? null
                                      : {
                                          id: inv.id,
                                          top: rect.bottom + 4,
                                          right: window.innerWidth - rect.right,
                                        },
                                  );
                                }}
                                className="rounded-md p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-600"
                                title="Mais opções"
                              >
                                <svg
                                  className="h-4 w-4"
                                  viewBox="0 0 20 20"
                                  fill="currentColor"
                                >
                                  <path d="M10 3a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM10 8.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM11.5 15.5a1.5 1.5 0 10-3 0 1.5 1.5 0 003 0z" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {!isLoading && tabFiltered.length > 0 && (
              <div className="flex items-center justify-between border-t border-[#F5C992]/40 px-4 py-3">
                <p className="text-xs text-stone-500">
                  Mostrando{" "}
                  {Math.min((page - 1) * pageSize + 1, tabFiltered.length)} a{" "}
                  {Math.min(page * pageSize, tabFiltered.length)} de{" "}
                  {tabFiltered.length} fatura
                  {tabFiltered.length !== 1 ? "s" : ""}
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="flex h-7 w-7 items-center justify-center rounded border border-stone-200 text-stone-500 hover:bg-stone-50 disabled:opacity-40"
                  >
                    <svg
                      className="h-3.5 w-3.5"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                    (p) => (
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        className={`flex h-7 w-7 items-center justify-center rounded border text-xs font-medium ${
                          p === page
                            ? "border-[#ED5C32] bg-[#ED5C32]/10 text-[#ED5C32]"
                            : "border-stone-200 text-stone-500 hover:bg-stone-50"
                        }`}
                      >
                        {p}
                      </button>
                    ),
                  )}
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages || totalPages === 0}
                    className="flex h-7 w-7 items-center justify-center rounded border border-stone-200 text-stone-500 hover:bg-stone-50 disabled:opacity-40"
                  >
                    <svg
                      className="h-3.5 w-3.5"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Calendar mode */}
        {viewMode === "calendar" && (
          <div
            className={`flex gap-4 items-start ${selectedCalendarDay ? "xl:grid xl:grid-cols-[1fr,360px]" : ""}`}
          >
            <div className="min-w-0 flex-1">
              <InvoiceCalendarView
                invoicesByDate={invoicesByDueDate}
                noDueDateInvoices={noDueDateInvoices}
                month={calendarMonth}
                selectedDay={selectedCalendarDay?.dateStr ?? null}
                onPrevMonth={() => {
                  setCalendarMonth(
                    (m) => new Date(m.getFullYear(), m.getMonth() - 1, 1),
                  );
                  setSelectedCalendarDay(null);
                }}
                onNextMonth={() => {
                  setCalendarMonth(
                    (m) => new Date(m.getFullYear(), m.getMonth() + 1, 1),
                  );
                  setSelectedCalendarDay(null);
                }}
                onToday={() => {
                  setCalendarMonth(
                    new Date(
                      new Date().getFullYear(),
                      new Date().getMonth(),
                      1,
                    ),
                  );
                  setSelectedCalendarDay(null);
                }}
                onDayClick={(dateStr, dayInvoices) =>
                  setSelectedCalendarDay((prev) =>
                    prev?.dateStr === dateStr
                      ? null
                      : { dateStr, invoices: dayInvoices },
                  )
                }
              />
            </div>
            {selectedCalendarDay && selectedCalendarDayInvoices && (
              <div className="w-full xl:w-auto xl:sticky xl:top-4">
                <CalendarDayPanel
                  dateStr={selectedCalendarDay.dateStr}
                  invoices={selectedCalendarDayInvoices}
                  onClose={() => setSelectedCalendarDay(null)}
                  onView={(inv) => setDetail(inv)}
                  onPay={(inv) => setMarkPaidInvoice(inv)}
                />
              </div>
            )}
          </div>
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
            bankAccounts={bankAccounts}
            onClose={() => setDetail(null)}
            onOpenMarkPaid={setMarkPaidInvoice}
            onInvoiceUpdated={(updated) => setDetail(updated)}
          />
        )}

        {markPaidInvoice && (
          <MarkPaidModal
            invoice={markPaidInvoice}
            onConfirm={(paidAt, bankAccountId, paymentMethod, paymentNotes) =>
              void handleMarkPaid(
                markPaidInvoice.id,
                paidAt,
                bankAccountId,
                paymentMethod,
                paymentNotes,
              )
            }
            onClose={() => setMarkPaidInvoice(null)}
            saving={markingPaidId === markPaidInvoice.id}
          />
        )}

        {deleteConfirmInvoice && (
          <DeleteConfirmModal
            invoice={deleteConfirmInvoice}
            onConfirm={() => deleteMutation.mutate(deleteConfirmInvoice.id)}
            onClose={() => setDeleteConfirmInvoice(null)}
            deleting={
              deleteMutation.isPending &&
              deleteMutation.variables === deleteConfirmInvoice.id
            }
          />
        )}
      </div>

      <PageFooter />

      {/* Row kebab menu — portal to escape table overflow */}
      {openRowMenu &&
        (() => {
          const inv = paginated.find((i) => i.id === openRowMenu.id);
          if (!inv) return null;
          return createPortal(
            <>
              <div
                className="fixed inset-0 z-[49]"
                onClick={() => setOpenRowMenu(null)}
              />
              <div
                className="fixed z-50 w-44 rounded-lg border border-stone-200 bg-white py-1 shadow-lg"
                style={{ top: openRowMenu.top, right: openRowMenu.right }}
              >
                <button
                  onClick={() => {
                    setOpenRowMenu(null);
                    setDeleteConfirmInvoice(inv);
                  }}
                  disabled={
                    deleteMutation.isPending &&
                    deleteMutation.variables === inv.id
                  }
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-40"
                >
                  <svg
                    className="h-4 w-4 text-red-400"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Eliminar
                </button>
              </div>
            </>,
            document.body,
          );
        })()}
    </div>
  );
}
