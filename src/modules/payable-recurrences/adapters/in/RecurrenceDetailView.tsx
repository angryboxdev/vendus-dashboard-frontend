import { useState, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usePayableRecurrencesModule } from "../../payable-recurrences.module.tsx";
import { useBankAccountsModule } from "../../../bank-accounts/bank-accounts.module.tsx";
import { useInvoicesModule } from "../../../invoices/invoices.module.tsx";
import type { BankDTO, AccountPreviewDTO } from "../../../bank-accounts/domain/entities/bank-account.ts";
import type { InvoiceDTO } from "../../../invoices/domain/entities/invoice.ts";
import {
  PAYMENT_METHOD_LABELS as INVOICE_PAYMENT_METHOD_LABELS,
  INVOICE_STATUS_LABELS,
} from "../../../invoices/domain/entities/invoice.ts";
import {
  type RecurrenceDTO,
  type OccurrenceDTO,
  type OccurrenceStatus,
  type UpdateRecurrencePayload,
  RECURRENCE_TYPE_LABELS,
  RECURRENCE_FREQUENCY_LABELS,
  RECURRENCE_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  OCCURRENCE_STATUS_LABELS,
  expectedDocumentLabel,
  nextDueDate,
  formatPeriod,
} from "../../domain/entities/recurrence.ts";
import { RecurrenceDrawer } from "./RecurrenceDrawer.tsx";
import { PageFooter } from "../../../../components/PageFooter.tsx";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fromCents(n: number | null | undefined): string {
  if (n == null) return "—";
  return (n / 100).toLocaleString("pt-PT", { style: "currency", currency: "EUR" });
}

function formatDate(s: string | null | undefined): string {
  if (!s) return "—";
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y}`;
}

function formatDateObj(d: Date): string {
  return d.toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function daysUntil(d: Date): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / 86_400_000);
}

/** Compute next N due dates from dayOfMonth + frequency, respecting endDate */
function upcomingDueDates(r: RecurrenceDTO, count: number): Date[] {
  const results: Date[] = [];
  const now = new Date();
  let candidate = new Date(now.getFullYear(), now.getMonth(), r.dayOfMonth);
  if (candidate <= now) {
    candidate = new Date(now.getFullYear(), now.getMonth() + 1, r.dayOfMonth);
  }
  const endDate = r.endDate ? new Date(r.endDate) : null;
  const monthsStep =
    r.frequency === "annual" ? 12 : r.frequency === "quarterly" ? 3 : 1;
  for (let i = 0; i < count; i++) {
    if (endDate && candidate > endDate) break;
    results.push(new Date(candidate));
    candidate = new Date(
      candidate.getFullYear(),
      candidate.getMonth() + monthsStep,
      r.dayOfMonth,
    );
  }
  return results;
}

// ── Status badges ─────────────────────────────────────────────────────────────

const OCC_STATUS_COLORS: Record<OccurrenceStatus, string> = {
  forecast: "bg-blue-50 text-blue-700",
  awaiting_invoice: "bg-amber-50 text-amber-700",
  invoice_linked: "bg-purple-50 text-purple-700",
  paid: "bg-emerald-50 text-emerald-700",
  cancelled: "bg-stone-100 text-stone-500",
};

const OCC_STATUS_DOT: Record<OccurrenceStatus, string> = {
  forecast: "bg-blue-400",
  awaiting_invoice: "bg-amber-500",
  invoice_linked: "bg-purple-500",
  paid: "bg-emerald-500",
  cancelled: "bg-stone-400",
};

function OccurrenceStatusBadge({ status }: { status: OccurrenceStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${OCC_STATUS_COLORS[status]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${OCC_STATUS_DOT[status]}`} />
      {OCCURRENCE_STATUS_LABELS[status]}
    </span>
  );
}

// ── KPI card ──────────────────────────────────────────────────────────────────

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

// ── Link Invoice Modal ────────────────────────────────────────────────────────

function LinkInvoiceModal({
  onConfirm,
  onClose,
  saving,
}: {
  onConfirm: (invoiceId: string) => void;
  onClose: () => void;
  saving: boolean;
}) {
  const { api: invApi } = useInvoicesModule();
  const { api: recApi } = usePayableRecurrencesModule();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selected, setSelected] = useState<InvoiceDTO | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const { data: linkedIds = [] } = useQuery({
    queryKey: ["payable-recurrences-linked-invoice-ids"],
    queryFn: () => recApi.getLinkedInvoiceIds(),
    staleTime: 30_000,
  });
  const linkedInvoiceIds = new Set(linkedIds);

  const { data: results = [], isFetching } = useQuery({
    queryKey: ["invoices-link-search", debouncedSearch],
    queryFn: () => invApi.listInvoices({ search: debouncedSearch }),
    enabled: debouncedSearch.length >= 2,
  });

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-xl bg-white shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 pt-5 pb-4">
          <h3 className="text-base font-bold text-stone-900">Vincular fatura</h3>
          <button onClick={onClose} className="rounded-md p-1 text-stone-400 hover:bg-stone-100">
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>

        <div className="px-6 pb-2 space-y-3 flex-1 overflow-y-auto">
          <input
            autoFocus
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setSelected(null); }}
            placeholder="Pesquisar por fornecedor ou nº de fatura…"
            className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:border-[#ED5C32]"
          />

          {debouncedSearch.length < 2 && (
            <p className="text-xs text-stone-400 text-center py-4">Escreva pelo menos 2 caracteres para pesquisar.</p>
          )}

          {debouncedSearch.length >= 2 && isFetching && (
            <p className="text-xs text-stone-400 text-center py-4">A pesquisar…</p>
          )}

          {debouncedSearch.length >= 2 && !isFetching && results.length === 0 && (
            <p className="text-xs text-stone-400 text-center py-4">Nenhuma fatura encontrada.</p>
          )}

          {results.length > 0 && (
            <div className="space-y-1.5 max-h-60 overflow-y-auto">
              {results.map((inv) => {
                const alreadyLinked = linkedInvoiceIds.has(inv.id);
                return alreadyLinked ? (
                  <div
                    key={inv.id}
                    className="w-full text-left rounded-lg border border-stone-100 bg-stone-50 px-3 py-2.5 opacity-60 cursor-not-allowed"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-stone-400 truncate">{inv.supplierName}</span>
                      <span className="text-xs font-semibold text-stone-400 shrink-0">
                        {inv.totalWithVat != null ? (inv.totalWithVat / 100).toLocaleString("pt-PT", { style: "currency", currency: "EUR" }) : "—"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-stone-400">{inv.invoiceNumber ?? "Sem nº"}</span>
                      {inv.dueDate && <span className="text-xs text-stone-400">· Venc. {inv.dueDate}</span>}
                    </div>
                    <span className="text-xs text-amber-600 font-medium mt-0.5">Já associada a outra ocorrência</span>
                  </div>
                ) : (
                  <button
                    key={inv.id}
                    onClick={() => setSelected(inv)}
                    className={`w-full text-left rounded-lg border px-3 py-2.5 transition-colors ${
                      selected?.id === inv.id
                        ? "border-[#ED5C32] bg-orange-50"
                        : "border-stone-200 hover:border-stone-300 hover:bg-stone-50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-stone-800 truncate">{inv.supplierName}</span>
                      <span className="text-xs font-semibold text-stone-700 shrink-0">
                        {inv.totalWithVat != null ? (inv.totalWithVat / 100).toLocaleString("pt-PT", { style: "currency", currency: "EUR" }) : "—"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-stone-400">{inv.invoiceNumber ?? "Sem nº"}</span>
                      {inv.dueDate && <span className="text-xs text-stone-400">· Venc. {inv.dueDate}</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {selected && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
              Selecionada: <span className="font-semibold">{selected.supplierName}</span>
              {selected.invoiceNumber && <> · {selected.invoiceNumber}</>}
            </div>
          )}
        </div>

        <div className="px-6 pt-3 pb-5 border-t border-stone-100 mt-2 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-md border border-stone-300 py-2 text-sm font-medium text-stone-600 hover:bg-stone-50"
          >
            Cancelar
          </button>
          <button
            disabled={!selected || saving}
            onClick={() => selected && onConfirm(selected.id)}
            className="flex-1 rounded-md bg-gradient-to-r from-[#ED5C32] to-[#EF8935] py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving ? "A vincular…" : "Vincular fatura"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ── Mark Paid Modal ───────────────────────────────────────────────────────────

function bankAccountLabel(bank: BankDTO, acc: AccountPreviewDTO): string {
  const name = acc.nickname ?? acc.label;
  return acc.lastFourDigits
    ? `${name} (${bank.name}) •••• ${acc.lastFourDigits}`
    : `${name} (${bank.name})`;
}

function MarkPaidModal({
  occ,
  defaultPaymentMethod,
  onConfirm,
  onClose,
  saving,
}: {
  occ: { period: string; estimatedAmountCents: number; realAmountCents: number | null; dueDate: string; supplierName: string };
  defaultPaymentMethod: string;
  onConfirm: (paidAt: string, bankAccountId: string, paymentMethod: string, paymentNotes?: string) => void;
  onClose: () => void;
  saving: boolean;
}) {
  const { api: bankApi } = useBankAccountsModule();
  const today = new Date().toISOString().slice(0, 10);
  const [paidAt, setPaidAt] = useState(today);
  const [bankAccountId, setBankAccountId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState(defaultPaymentMethod);
  const [paymentNotes, setPaymentNotes] = useState("");

  const { data: banks = [] } = useQuery({
    queryKey: ["banks-for-occurrence-payment"],
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
  const effectiveAmount = occ.realAmountCents ?? occ.estimatedAmountCents;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-xl bg-white shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 pt-5 pb-4">
          <h3 className="text-base font-bold text-stone-900">Confirmar pagamento</h3>
          <button onClick={onClose} className="rounded-md p-1 text-stone-400 hover:bg-stone-100">
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 pb-2 space-y-4">
          {/* Data de pagamento */}
          <div>
            <label className="mb-1 block text-xs font-medium text-stone-600">
              Data de pagamento <span className="text-red-500">*</span>
            </label>
            <input
              autoFocus
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
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm focus:outline-none focus:border-[#ED5C32]"
            >
              <option value="">— selecionar método —</option>
              {(Object.entries(PAYMENT_METHOD_LABELS) as [string, string][]).map(([k, v]) => (
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
              rows={2}
              placeholder="Ex: Pago via homebanking…"
              className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm focus:outline-none focus:border-[#ED5C32] resize-none"
            />
            <p className="mt-0.5 text-right text-xs text-stone-400">{paymentNotes.length}/200</p>
          </div>

          {/* Resumo */}
          <div className="rounded-lg border border-stone-100 bg-stone-50 p-3 text-xs">
            <p className="mb-2 font-semibold text-stone-600">Resumo do pagamento</p>
            <dl className="divide-y divide-stone-100">
              {[
                { label: "Fornecedor", value: occ.supplierName },
                { label: "Período", value: formatPeriod(occ.period) },
                { label: "Vencimento", value: occ.dueDate },
                { label: "Valor", value: (effectiveAmount / 100).toLocaleString("pt-PT", { style: "currency", currency: "EUR" }) },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between py-1.5">
                  <dt className="text-stone-400">{label}</dt>
                  <dd className="font-semibold text-stone-700">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        <div className="px-6 pt-3 pb-5 border-t border-stone-100 mt-2 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-md border border-stone-300 py-2 text-sm font-medium text-stone-600 hover:bg-stone-50"
          >
            Cancelar
          </button>
          <button
            disabled={!isValid || saving}
            onClick={() => onConfirm(paidAt, bankAccountId, paymentMethod, paymentNotes || undefined)}
            className="flex-1 rounded-md bg-emerald-600 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {saving ? "A registar…" : "Confirmar pagamento"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ── View Invoice Modal ────────────────────────────────────────────────────────

function ViewInvoiceModal({
  invoiceId,
  onClose,
}: {
  invoiceId: string;
  onClose: () => void;
}) {
  const { api: invApi } = useInvoicesModule();
  const navigate = useNavigate();

  const { data: invoice, isLoading } = useQuery<InvoiceDTO>({
    queryKey: ["invoice-detail", invoiceId],
    queryFn: () => invApi.getInvoice(invoiceId),
  });

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between px-6 pt-5 pb-4">
          <h3 className="text-base font-bold text-stone-900">Fatura associada</h3>
          <button onClick={onClose} className="rounded-md p-1 text-stone-400 hover:bg-stone-100">
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>

        <div className="px-6 pb-5 space-y-4">
          {isLoading && (
            <p className="text-xs text-stone-400 text-center py-4">A carregar fatura…</p>
          )}
          {invoice && (
            <>
              <div className="divide-y divide-stone-100">
                {[
                  { label: "Fornecedor", value: invoice.supplierName },
                  { label: "Nº fatura", value: invoice.invoiceNumber ?? "—" },
                  { label: "Vencimento", value: formatDate(invoice.dueDate) },
                  {
                    label: "Total",
                    value: invoice.totalWithVat != null
                      ? (invoice.totalWithVat / 100).toLocaleString("pt-PT", { style: "currency", currency: "EUR" })
                      : "—",
                  },
                  {
                    label: "Estado",
                    value: INVOICE_STATUS_LABELS[invoice.status] ?? invoice.status,
                  },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between py-2 first:pt-0">
                    <dt className="text-xs text-stone-400">{label}</dt>
                    <dd className="text-xs font-medium text-stone-700">{value}</dd>
                  </div>
                ))}
              </div>
              <button
                onClick={() => {
                  onClose();
                  navigate(`/financial/invoices?open=${invoiceId}`);
                }}
                className="w-full rounded-md bg-gradient-to-r from-[#ED5C32] to-[#EF8935] py-2 text-sm font-medium text-white hover:opacity-90"
              >
                Ver fatura completa →
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ── Occurrence Row ────────────────────────────────────────────────────────────

function OccurrenceRow({
  occ,
  onMarkPaid,
  onLinkInvoice,
  onViewInvoice,
  onCancel,
  onUploadDoc,
  onDeleteDoc,
  busyId,
}: {
  occ: OccurrenceDTO;
  onMarkPaid: (id: string) => void;
  onLinkInvoice: (id: string) => void;
  onViewInvoice: (invoiceId: string) => void;
  onCancel: (id: string) => void;
  onUploadDoc: (id: string, file: File) => void;
  onDeleteDoc: (id: string) => void;
  busyId: string | null;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);
  const isBusy = busyId === occ.id;
  const canCancel = !["paid", "cancelled"].includes(occ.status);
  const canMarkPaid = !occ.invoiceId &&
    ["forecast", "invoice_linked"].includes(occ.status) &&
    (!occ.requireInvoice || occ.status === "invoice_linked");
  const canLinkInvoice = ["forecast", "awaiting_invoice"].includes(occ.status);
  const canAttachDoc = !occ.invoiceId;

  useEffect(() => {
    if (!menuOpen) return;
    function handleOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [menuOpen]);

  return (
    <tr className="hover:bg-[#FDF8F5]">
      <td className="px-3 py-2.5 text-sm font-medium text-stone-700 whitespace-nowrap">
        {formatPeriod(occ.period)}
      </td>
      <td className="px-3 py-2.5">
        <OccurrenceStatusBadge status={occ.status} />
      </td>
      <td className="px-3 py-2.5 text-sm text-stone-700 whitespace-nowrap">{fromCents(occ.estimatedAmountCents)}</td>
      <td className="px-3 py-2.5">
        {occ.invoiceId ? (
          <button
            onClick={() => onViewInvoice(occ.invoiceId!)}
            className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] text-blue-700 font-medium whitespace-nowrap hover:bg-blue-100"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-blue-400 shrink-0" />
            {occ.realAmountCents != null ? fromCents(occ.realAmountCents) : "—"}
            <span className="text-blue-300">·</span>
            Ver
          </button>
        ) : (
          <span className="text-stone-300 text-sm">—</span>
        )}
      </td>
      <td className="px-3 py-2.5 text-xs text-stone-600 whitespace-nowrap">
        {occ.paidAt ? occ.paidAt.slice(0, 10) : <span className="text-stone-300">—</span>}
      </td>
      <td className="px-3 py-2.5">
        {isBusy ? (
          <span className="text-xs text-stone-400">…</span>
        ) : (
          <div className="inline-block" ref={menuRef}>
            <button
              ref={buttonRef}
              onClick={() => {
                if (!menuOpen) {
                  const rect = buttonRef.current?.getBoundingClientRect();
                  if (rect) setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
                }
                setMenuOpen((o) => !o);
              }}
              className="rounded p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-600"
              title="Ações"
            >
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zM12 10a2 2 0 11-4 0 2 2 0 014 0zM18 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </button>
            {menuOpen && menuPos && createPortal(
              <div
                ref={menuRef}
                className="fixed z-50 w-48 rounded-lg border border-stone-200 bg-white py-1 shadow-lg"
                style={{ top: menuPos.top, right: menuPos.right }}
              >
                {canMarkPaid && (
                  <button
                    onClick={() => { setMenuOpen(false); onMarkPaid(occ.id); }}
                    className="flex w-full items-center px-3 py-2 text-xs text-emerald-700 hover:bg-stone-50"
                  >
                    Marcar pago
                  </button>
                )}
                {canLinkInvoice && (
                  <button
                    onClick={() => { setMenuOpen(false); onLinkInvoice(occ.id); }}
                    className="flex w-full items-center px-3 py-2 text-xs text-purple-700 hover:bg-stone-50"
                  >
                    Vincular fatura
                  </button>
                )}
                {canAttachDoc && (occ.documentUrl ? (
                  <button
                    onClick={() => { setMenuOpen(false); onDeleteDoc(occ.id); }}
                    className="flex w-full items-center px-3 py-2 text-xs text-stone-600 hover:bg-stone-50"
                  >
                    Remover documento
                  </button>
                ) : (
                  <button
                    onClick={() => { setMenuOpen(false); fileRef.current?.click(); }}
                    className="flex w-full items-center px-3 py-2 text-xs text-stone-600 hover:bg-stone-50"
                  >
                    Anexar comprovativo
                  </button>
                ))}
                {canCancel && (
                  <div className="border-t border-stone-100 mt-1 pt-1">
                    <button
                      onClick={() => { setMenuOpen(false); onCancel(occ.id); }}
                      className="flex w-full items-center px-3 py-2 text-xs text-red-600 hover:bg-red-50"
                    >
                      Apagar
                    </button>
                  </div>
                )}
              </div>,
              document.body,
            )}
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onUploadDoc(occ.id, f);
              }}
            />
          </div>
        )}
      </td>
    </tr>
  );
}

// ── Main Detail View ──────────────────────────────────────────────────────────

export function RecurrenceDetailView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { api } = usePayableRecurrencesModule();
  const qc = useQueryClient();

  const [showEdit, setShowEdit] = useState(false);
  const [linkInvoiceOccId, setLinkInvoiceOccId] = useState<string | null>(null);
  const [markPaidOccId, setMarkPaidOccId] = useState<string | null>(null);
  const [viewInvoiceId, setViewInvoiceId] = useState<string | null>(null);
  const [busyOccId, setBusyOccId] = useState<string | null>(null);
  const docFileRef = useRef<HTMLInputElement>(null);

  // ── Queries ─────────────────────────────────────────────────────────────────
  const { data: recurrence, isLoading } = useQuery({
    queryKey: ["payable-recurrences", id],
    queryFn: () => api.getRecurrence(id!),
    enabled: !!id,
  });

  const { data: occurrences = [] } = useQuery({
    queryKey: ["payable-recurrences", id, "occurrences"],
    queryFn: () => api.listOccurrences(id!),
    enabled: !!id,
  });

  // ── Mutations ────────────────────────────────────────────────────────────────
  function invalidate() {
    void qc.invalidateQueries({ queryKey: ["payable-recurrences", id] });
    void qc.invalidateQueries({ queryKey: ["payable-recurrences", id, "occurrences"] });
    void qc.invalidateQueries({ queryKey: ["payable-recurrences"] });
  }

  const updateMutation = useMutation({
    mutationFn: (payload: UpdateRecurrencePayload) =>
      api.updateRecurrence(id!, payload),
    onSuccess: () => {
      invalidate();
      setShowEdit(false);
    },
  });

  const pauseMutation = useMutation({
    mutationFn: () => api.pauseRecurrence(id!),
    onSuccess: invalidate,
  });

  const resumeMutation = useMutation({
    mutationFn: () => api.resumeRecurrence(id!),
    onSuccess: invalidate,
  });

  const closeMutation = useMutation({
    mutationFn: () => api.closeRecurrence(id!),
    onSuccess: invalidate,
  });

  const uploadDocMutation = useMutation({
    mutationFn: (file: File) => api.uploadRecurrenceDocument(id!, file),
    onSuccess: invalidate,
  });

  const deleteDocMutation = useMutation({
    mutationFn: () => api.deleteRecurrenceDocument(id!),
    onSuccess: invalidate,
  });

  const generateOccMutation = useMutation({
    mutationFn: ({ year, month }: { year: number; month: number }) =>
      api.generateOccurrence(id!, year, month),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["payable-recurrences", id, "occurrences"] });
    },
  });

  const markOccurrenceAsPaidMutation = useMutation({
    mutationFn: ({ occId, paidAt, bankAccountId, paymentMethod, paymentNotes }: { occId: string; paidAt: string; bankAccountId: string; paymentMethod: string; paymentNotes?: string }) =>
      api.markOccurrenceAsPaid(occId, {
        paidAt,
        paymentMethod: paymentMethod as import("../../domain/entities/recurrence.ts").PaymentMethod,
        paymentBankAccountId: bankAccountId,
        paymentNotes,
      }),
    onSuccess: () => {
      setBusyOccId(null);
      setMarkPaidOccId(null);
      void qc.invalidateQueries({ queryKey: ["payable-recurrences", id, "occurrences"] });
      void qc.invalidateQueries({ queryKey: ["payable-recurrences-summary"] });
    },
  });

  const linkInvoiceMutation = useMutation({
    mutationFn: ({ occId, invoiceId }: { occId: string; invoiceId: string }) =>
      api.linkInvoiceToOccurrence(occId, invoiceId),
    onSuccess: () => {
      setBusyOccId(null);
      setLinkInvoiceOccId(null);
      void qc.invalidateQueries({ queryKey: ["payable-recurrences", id, "occurrences"] });
    },
  });

  const cancelOccMutation = useMutation({
    mutationFn: (occId: string) => api.cancelOccurrence(occId),
    onSuccess: () => {
      setBusyOccId(null);
      void qc.invalidateQueries({ queryKey: ["payable-recurrences", id, "occurrences"] });
    },
  });

  const uploadOccDocMutation = useMutation({
    mutationFn: ({ occId, file }: { occId: string; file: File }) =>
      api.uploadOccurrenceDocument(occId, file),
    onSuccess: () => {
      setBusyOccId(null);
      void qc.invalidateQueries({ queryKey: ["payable-recurrences", id, "occurrences"] });
    },
  });

  const deleteOccDocMutation = useMutation({
    mutationFn: (occId: string) => api.deleteOccurrenceDocument(occId),
    onSuccess: () => {
      setBusyOccId(null);
      void qc.invalidateQueries({ queryKey: ["payable-recurrences", id, "occurrences"] });
    },
  });

  // ── Generate current month occurrence ────────────────────────────────────────
  const now = new Date();
  const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const hasCurrentOccurrence = occurrences.some((o) => o.period === currentPeriod);
  const lastOccurrence = occurrences
    .filter((o) => o.status !== "cancelled")
    .sort((a, b) => b.period.localeCompare(a.period))[0];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FAF6F3] flex items-center justify-center">
        <p className="text-sm text-stone-400">A carregar…</p>
      </div>
    );
  }

  if (!recurrence) {
    return (
      <div className="min-h-screen bg-[#FAF6F3] flex items-center justify-center">
        <p className="text-sm text-red-500">Recorrência não encontrada.</p>
      </div>
    );
  }

  const rawNd = nextDueDate(recurrence.dayOfMonth);
  const nd = recurrence.endDate && rawNd > new Date(recurrence.endDate) ? null : rawNd;
  const ndDays = nd ? daysUntil(nd) : null;
  const upcoming = upcomingDueDates(recurrence, 3);

  return (
    <div className="min-h-screen bg-[#FAF6F3]">
      {/* Header */}
      <div className="border-b border-[#F5C992]/40 bg-white px-6 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <button
              onClick={() => navigate("/financial/obligations")}
              className="mt-0.5 rounded-md p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-600"
            >
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
            <div>
              <h1 className="text-xl font-bold text-stone-900">{recurrence.name}</h1>
              <p className="text-sm text-stone-500">
                {recurrence.supplierName} · {RECURRENCE_TYPE_LABELS[recurrence.type]} ·{" "}
                {RECURRENCE_FREQUENCY_LABELS[recurrence.frequency]}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Attach document — only shown when no document yet */}
            {!recurrence.documentUrl && (
              <>
                <button
                  onClick={() => docFileRef.current?.click()}
                  disabled={uploadDocMutation.isPending}
                  className="flex items-center gap-1.5 rounded-lg border border-stone-300 px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50"
                >
                  <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M15.621 4.379a3 3 0 00-4.242 0l-7 7a1.5 1.5 0 002.122 2.121L14 7.243a.75.75 0 011.06 1.06L7.561 15.8a3 3 0 01-4.243-4.243l7-7a4.5 4.5 0 016.364 6.364l-3.536 3.536a.75.75 0 01-1.06-1.06l3.535-3.536a3 3 0 000-4.243z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {uploadDocMutation.isPending ? "A anexar…" : "Anexar contrato"}
                </button>
                <input
                  ref={docFileRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadDocMutation.mutate(f);
                  }}
                />
              </>
            )}

            {/* State actions */}
            {recurrence.status === "active" && (
              <button
                onClick={() => pauseMutation.mutate()}
                disabled={pauseMutation.isPending}
                className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-50"
              >
                {pauseMutation.isPending ? "…" : "Pausar"}
              </button>
            )}
            {recurrence.status === "paused" && (
              <button
                onClick={() => resumeMutation.mutate()}
                disabled={resumeMutation.isPending}
                className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
              >
                {resumeMutation.isPending ? "…" : "Retomar"}
              </button>
            )}
            {recurrence.status !== "closed" && (
              <button
                onClick={() => {
                  if (confirm("Fechar esta recorrência? Esta ação não pode ser desfeita.")) {
                    closeMutation.mutate();
                  }
                }}
                disabled={closeMutation.isPending}
                className="rounded-lg border border-stone-300 px-3 py-2 text-sm font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-50"
              >
                {closeMutation.isPending ? "…" : "Fechar"}
              </button>
            )}
            <button
              onClick={() => setShowEdit(true)}
              className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#ED5C32] to-[#EF8935] px-3 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M2.695 14.763l-1.262 3.154a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.885L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z" />
              </svg>
              Editar
            </button>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <KpiCard
            label="Próximo vencimento"
            value={nd ? formatDateObj(nd) : "—"}
            sub={
              nd == null
                ? "Sem vencimentos futuros"
                : ndDays === 0
                ? "hoje"
                : ndDays === 1
                ? "amanhã"
                : `em ${ndDays} dias`
            }
            accentClass={nd && ndDays !== null && ndDays <= 7 && recurrence.status === "active" ? "text-red-600" : "text-stone-800"}
          />
          <KpiCard
            label="Valor previsto"
            value={fromCents(recurrence.estimatedAmountCents)}
            sub="estimado"
          />
          <div className="rounded-xl border border-[#F5C992]/40 bg-white px-5 py-4 shadow-sm">
            <p className="text-xs font-medium text-stone-500">Estado atual</p>
            <div className="mt-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ${
                  recurrence.status === "active"
                    ? "bg-emerald-50 text-emerald-700"
                    : recurrence.status === "paused"
                    ? "bg-amber-50 text-amber-700"
                    : "bg-stone-100 text-stone-500"
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    recurrence.status === "active"
                      ? "bg-emerald-500"
                      : recurrence.status === "paused"
                      ? "bg-amber-500"
                      : "bg-stone-400"
                  }`}
                />
                {RECURRENCE_STATUS_LABELS[recurrence.status]}
              </span>
            </div>
          </div>
          <KpiCard
            label="Última ocorrência"
            value={lastOccurrence ? formatPeriod(lastOccurrence.period) : "—"}
            sub={lastOccurrence ? OCCURRENCE_STATUS_LABELS[lastOccurrence.status] : ""}
          />
        </div>

        {/* Layout: 1/3 Resumo | 2/3 (Ocorrências + linha inferior) */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

          {/* Col 1 (1/3): Resumo */}
          <div className="rounded-xl border border-[#F5C992]/40 bg-white p-6">
            <h2 className="text-sm font-semibold text-stone-800 mb-4">
              Resumo da recorrência
            </h2>
            <dl className="divide-y divide-stone-100">
              {[
                { label: "Fornecedor", value: recurrence.supplierName },
                { label: "Tipo", value: RECURRENCE_TYPE_LABELS[recurrence.type] },
                { label: "Frequência", value: RECURRENCE_FREQUENCY_LABELS[recurrence.frequency] },
                { label: "Dia de vencimento", value: `Dia ${recurrence.dayOfMonth} do mês` },
                { label: "Data de início", value: formatDate(recurrence.startDate) },
                { label: "Data de fim", value: recurrence.endDate ? formatDate(recurrence.endDate) : "Sem fim definido" },
                { label: "Método de pagamento", value: PAYMENT_METHOD_LABELS[recurrence.paymentMethod] },
                { label: "Categoria", value: recurrence.category ?? "—" },
                { label: "Documento esperado", value: expectedDocumentLabel(recurrence) },
                { label: "Exige fatura", value: recurrence.requireInvoice ? "Sim" : "Não" },
                { label: "Notas", value: recurrence.notes ?? "—" },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between gap-3 py-2.5">
                  <dt className="text-xs text-stone-400 shrink-0">{label}</dt>
                  <dd className="text-sm font-medium text-stone-700 text-right">{value}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Col 2 (2/3): Ocorrências + linha inferior */}
          <div className="lg:col-span-2 flex flex-col gap-6">

            {/* Linha 1: Ocorrências mensais */}
            <div className="rounded-xl border border-[#F5C992]/40 bg-white">
              <div className="flex items-center justify-between px-6 py-4 border-b border-[#F5C992]/40">
                <h2 className="text-sm font-semibold text-stone-800">Ocorrências mensais</h2>
                {!hasCurrentOccurrence && recurrence.status === "active" && (
                  <button
                    onClick={() => generateOccMutation.mutate({ year: now.getFullYear(), month: now.getMonth() + 1 })}
                    disabled={generateOccMutation.isPending}
                    className="flex items-center gap-1 rounded-lg bg-gradient-to-r from-[#ED5C32] to-[#EF8935] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
                  >
                    {generateOccMutation.isPending ? "A gerar…" : "+ Gerar ocorrência"}
                  </button>
                )}
              </div>
              {occurrences.length === 0 ? (
                <div className="py-12 text-center text-sm text-stone-400">
                  Sem ocorrências registadas.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-stone-50/60">
                      <tr>
                        {["Mês", "Estado", "Previsto", "Fatura", "Pagamento", "Ações"].map((h) => (
                          <th key={h} className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-stone-400 whitespace-nowrap">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F5C992]/30">
                      {[...occurrences]
                        .sort((a, b) => b.period.localeCompare(a.period))
                        .map((occ) => (
                          <OccurrenceRow
                            key={occ.id}
                            occ={occ}
                            onMarkPaid={(occId) => setMarkPaidOccId(occId)}
                            onLinkInvoice={(occId) => setLinkInvoiceOccId(occId)}
                            onViewInvoice={(invoiceId) => setViewInvoiceId(invoiceId)}
                            onCancel={(occId) => { if (confirm("Apagar esta ocorrência? Poderá gerar uma nova para o mesmo período.")) { setBusyOccId(occId); cancelOccMutation.mutate(occId); } }}
                            onUploadDoc={(occId, file) => { setBusyOccId(occId); uploadOccDocMutation.mutate({ occId, file }); }}
                            onDeleteDoc={(occId) => { setBusyOccId(occId); deleteOccDocMutation.mutate(occId); }}
                            busyId={busyOccId}
                          />
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Linha 2: Próximos pagamentos + Documentos lado a lado */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">

              {/* Próximos pagamentos */}
              <div className="rounded-xl border border-[#F5C992]/40 bg-white p-5">
                <h2 className="text-sm font-semibold text-stone-800 mb-3">Próximos pagamentos</h2>
                {recurrence.status === "closed" ? (
                  <p className="text-xs text-stone-400">Recorrência encerrada.</p>
                ) : upcoming.length === 0 ? (
                  <p className="text-xs text-stone-400">Sem vencimentos futuros.</p>
                ) : (
                  <div className="space-y-2">
                    {upcoming.map((date, i) => {
                      const days = daysUntil(date);
                      return (
                        <div key={i} className="flex items-center justify-between rounded-lg bg-stone-50 px-3 py-2">
                          <div className="flex items-center gap-2">
                            <div className="text-center w-8">
                              <p className="text-lg font-bold leading-none text-stone-800">{date.getDate()}</p>
                              <p className="text-[10px] text-stone-400 uppercase">
                                {date.toLocaleDateString("pt-PT", { month: "short" })}
                              </p>
                            </div>
                            <span className="text-xs text-stone-500 truncate max-w-[100px]">{recurrence.supplierName}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs font-semibold text-stone-700">{fromCents(recurrence.estimatedAmountCents)}</span>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${days <= 7 ? "bg-amber-50 text-amber-700" : "bg-stone-100 text-stone-500"}`}>
                              {i === 0 && days <= 7 ? "Pendente" : "Previsto"}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Documentos */}
              <div className="rounded-xl border border-[#F5C992]/40 bg-white p-5">
                <h2 className="text-sm font-semibold text-stone-800 mb-3">Documentos</h2>
                <div className="mb-4">
                  <p className="text-xs font-medium text-stone-500 mb-2">Documento base</p>
                  {recurrence.documentUrl ? (
                    <div className="flex items-center justify-between rounded-lg border border-stone-100 bg-stone-50 px-3 py-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <svg className="h-4 w-4 shrink-0 text-stone-400" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                        </svg>
                        <span className="text-xs text-stone-600 truncate">Contrato base</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <a href={recurrence.documentUrl} target="_blank" rel="noopener noreferrer" className="rounded px-2 py-1 text-xs text-[#ED5C32] hover:bg-orange-50">Ver</a>
                        <button onClick={() => deleteDocMutation.mutate()} disabled={deleteDocMutation.isPending} className="rounded px-2 py-1 text-xs text-stone-400 hover:bg-stone-100 disabled:opacity-50">✕</button>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-stone-200 p-3 text-center">
                      <p className="text-xs text-stone-400 mb-2">Nenhum documento anexado</p>
                      <button onClick={() => docFileRef.current?.click()} className="text-xs text-[#ED5C32] hover:underline">Anexar contrato</button>
                    </div>
                  )}
                </div>
                {occurrences.filter((o) => o.documentUrl).length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-stone-500 mb-2">Documentos de ocorrências</p>
                    <div className="space-y-1">
                      {occurrences
                        .filter((o) => o.documentUrl)
                        .sort((a, b) => b.period.localeCompare(a.period))
                        .map((o) => (
                          <div key={o.id} className="flex items-center justify-between rounded-lg border border-stone-100 bg-stone-50 px-3 py-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <svg className="h-4 w-4 shrink-0 text-stone-400" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                              </svg>
                              <span className="text-xs text-stone-600 truncate capitalize">{formatPeriod(o.period)}</span>
                            </div>
                            <a href={o.documentUrl!} target="_blank" rel="noopener noreferrer" className="rounded px-2 py-1 text-xs text-[#ED5C32] hover:bg-orange-50 shrink-0">Ver</a>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>

            </div>
          </div>

        </div>
      </div>

      {/* Edit drawer */}
      <RecurrenceDrawer
        open={showEdit}
        editing={recurrence}
        saving={updateMutation.isPending}
        onClose={() => setShowEdit(false)}
        onCreate={() => {}}
        onUpdate={(_, payload) => updateMutation.mutate(payload)}
      />

      {/* Link invoice modal */}
      {linkInvoiceOccId && (
        <LinkInvoiceModal
          saving={linkInvoiceMutation.isPending}
          onClose={() => setLinkInvoiceOccId(null)}
          onConfirm={(invoiceId) => {
            setBusyOccId(linkInvoiceOccId);
            linkInvoiceMutation.mutate({ occId: linkInvoiceOccId, invoiceId });
          }}
        />
      )}

      {/* Mark paid modal */}
      {markPaidOccId && recurrence && (() => {
        const occ = occurrences.find((o) => o.id === markPaidOccId);
        if (!occ) return null;
        return (
          <MarkPaidModal
            occ={{ period: occ.period, estimatedAmountCents: occ.estimatedAmountCents, realAmountCents: occ.realAmountCents, dueDate: occ.dueDate, supplierName: recurrence.supplierName }}
            defaultPaymentMethod={recurrence.paymentMethod}
            saving={markOccurrenceAsPaidMutation.isPending}
            onClose={() => setMarkPaidOccId(null)}
            onConfirm={(paidAt, bankAccountId, paymentMethod, paymentNotes) => {
              setBusyOccId(markPaidOccId);
              markOccurrenceAsPaidMutation.mutate({ occId: markPaidOccId, paidAt, bankAccountId, paymentMethod, paymentNotes });
            }}
          />
        );
      })()}

      {/* View invoice modal */}
      {viewInvoiceId && (
        <ViewInvoiceModal
          invoiceId={viewInvoiceId}
          onClose={() => setViewInvoiceId(null)}
        />
      )}

      <PageFooter />
    </div>
  );
}
