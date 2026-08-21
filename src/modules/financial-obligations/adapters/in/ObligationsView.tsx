import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useFinancialObligationsModule } from "../../financial-obligations.module.tsx";
import { usePayableRecurrencesModule } from "../../../payable-recurrences/payable-recurrences.module.tsx";
import {
  type FinancialObligationDTO,
  type ObligationStatus,
  type ObligationSource,
  type PaymentMethod,
  type CreateManualObligationPayload,
  type MarkObligationAsPaidPayload,
  OBLIGATION_STATUS_LABELS,
  OBLIGATION_SOURCE_LABELS,
  PAYMENT_METHOD_LABELS,
  fromCents,
  formatDate,
  isEffectivelyOverdue,
  currentMonth,
} from "../../domain/entities/financial-obligation.ts";
import type { CreateRecurrencePayload } from "../../../payable-recurrences/domain/entities/recurrence.ts";
import {
  type RecurrenceDTO,
  type RecurrenceType,
  type RecurrenceStatus,
  RECURRENCE_TYPE_LABELS,
  RECURRENCE_STATUS_LABELS,
  RECURRENCE_FREQUENCY_LABELS,
  PAYMENT_METHOD_LABELS as RECURRENCE_PAYMENT_METHOD_LABELS,
  nextDueDate,
} from "../../../payable-recurrences/domain/entities/recurrence.ts";
import { RecurrenceDrawer } from "../../../payable-recurrences/adapters/in/RecurrenceDrawer.tsx";
import { ManualObligationDrawer } from "./ManualObligationDrawer.tsx";
import { PageFooter } from "../../../../components/PageFooter.tsx";

// ── StatusBadge (obligations) ──────────────────────────────────────────────────

const STATUS_COLORS: Record<ObligationStatus, string> = {
  pending: "bg-amber-50 text-amber-700",
  paid: "bg-emerald-50 text-emerald-700",
  overdue: "bg-red-50 text-red-700",
  cancelled: "bg-stone-100 text-stone-500",
};

const STATUS_DOT: Record<ObligationStatus, string> = {
  pending: "bg-amber-400",
  paid: "bg-emerald-500",
  overdue: "bg-red-500",
  cancelled: "bg-stone-400",
};

function effectiveStatus(o: FinancialObligationDTO): ObligationStatus {
  if (o.status === "pending" && isEffectivelyOverdue(o)) return "overdue";
  return o.status;
}

function StatusBadge({ obligation }: { obligation: FinancialObligationDTO }) {
  const st = effectiveStatus(obligation);
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[st]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[st]}`} />
      {OBLIGATION_STATUS_LABELS[st]}
    </span>
  );
}

// ── SourceBadge ───────────────────────────────────────────────────────────────

const SOURCE_COLORS: Record<ObligationSource, string> = {
  recurrence: "bg-blue-50 text-blue-700",
  manual: "bg-stone-100 text-stone-600",
};

function SourceBadge({ source }: { source: ObligationSource }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${SOURCE_COLORS[source]}`}
    >
      {OBLIGATION_SOURCE_LABELS[source]}
    </span>
  );
}

// ── RecurrenceStatusBadge ─────────────────────────────────────────────────────

const REC_STATUS_COLORS: Record<RecurrenceStatus, string> = {
  active: "bg-emerald-50 text-emerald-700",
  paused: "bg-amber-50 text-amber-700",
  closed: "bg-stone-100 text-stone-500",
};

const REC_STATUS_DOT: Record<RecurrenceStatus, string> = {
  active: "bg-emerald-500",
  paused: "bg-amber-400",
  closed: "bg-stone-400",
};

function RecurrenceStatusBadge({ status }: { status: RecurrenceStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${REC_STATUS_COLORS[status]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${REC_STATUS_DOT[status]}`} />
      {RECURRENCE_STATUS_LABELS[status]}
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

// ── MarkAsPaidModal ───────────────────────────────────────────────────────────

function MarkAsPaidModal({
  obligation,
  saving,
  onConfirm,
  onClose,
}: {
  obligation: FinancialObligationDTO;
  saving: boolean;
  onConfirm: (payload: MarkObligationAsPaidPayload) => void;
  onClose: () => void;
}) {
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | "">("");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <h2 className="mb-1 text-base font-bold text-stone-800">
          Marcar como pago
        </h2>
        <p className="mb-4 text-xs text-stone-400 truncate">
          {obligation.description}
        </p>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1">
              Data de pagamento *
            </label>
            <input
              required
              type="date"
              value={paidAt}
              onChange={(e) => setPaidAt(e.target.value)}
              className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm text-stone-800 outline-none focus:border-[#ED5C32] focus:ring-1 focus:ring-[#ED5C32]/30"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1">
              Método de pagamento
            </label>
            <select
              value={paymentMethod}
              onChange={(e) =>
                setPaymentMethod(e.target.value as PaymentMethod | "")
              }
              className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm text-stone-800 outline-none focus:border-[#ED5C32]"
            >
              <option value="">Não especificado</option>
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
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100"
          >
            Cancelar
          </button>
          <button
            disabled={!paidAt || saving}
            onClick={() =>
              onConfirm({
                paidAt,
                paymentMethod: (paymentMethod as PaymentMethod) || undefined,
              })
            }
            className="rounded-lg bg-gradient-to-r from-[#ED5C32] to-[#EF8935] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "A guardar…" : "Confirmar pagamento"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main View ──────────────────────────────────────────────────────────────────

export function ObligationsView() {
  const { api } = useFinancialObligationsModule();
  const { api: recurrencesApi } = usePayableRecurrencesModule();
  const navigate = useNavigate();
  const qc = useQueryClient();

  // ── UI state ─────────────────────────────────────────────────────────────────
  const [showRecurrenceDrawer, setShowRecurrenceDrawer] = useState(false);
  const [showManualDrawer, setShowManualDrawer] = useState(false);
  const [markingPaid, setMarkingPaid] = useState<FinancialObligationDTO | null>(
    null,
  );
  const [uploadingDoc, setUploadingDoc] = useState(false);

  // ── Tabs ─────────────────────────────────────────────────────────────────────
  type Tab = "recurrence" | "manual";
  const [activeTab, setActiveTab] = useState<Tab>("recurrence");

  // ── Obligation filters ────────────────────────────────────────────────────────
  const [fromFilter, setFromFilter] = useState("");
  const [toFilter, setToFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<ObligationStatus | "">("");

  // ── Recurrence filters ────────────────────────────────────────────────────────
  const [recSearch, setRecSearch] = useState("");
  const [recStatusFilter, setRecStatusFilter] = useState<RecurrenceStatus | "">(
    "active",
  );
  const [recTypeFilter, setRecTypeFilter] = useState<RecurrenceType | "">("");

  // ── Data ─────────────────────────────────────────────────────────────────────
  const { data: obligations = [], isLoading: obligationsLoading } = useQuery({
    queryKey: ["financial-obligations"],
    queryFn: () => api.listObligations(),
  });

  const { data: recurrences = [], isLoading: recurrencesLoading } = useQuery({
    queryKey: ["payable-recurrences"],
    queryFn: () => recurrencesApi.listRecurrences(),
  });

  const { data: summary } = useQuery({
    queryKey: ["payable-recurrences-summary"],
    queryFn: () => recurrencesApi.getSummary(),
  });

  const isLoading =
    activeTab === "recurrence" ? recurrencesLoading : obligationsLoading;

  // ── Obligation KPIs ───────────────────────────────────────────────────────────
  const obligationKpis = useMemo(() => {
    const month = currentMonth();
    let pendingCents = 0;
    let overdueCents = 0;
    let paidThisMonthCents = 0;

    for (const o of obligations) {
      if (o.status === "cancelled") continue;
      if (o.status === "paid") {
        if (o.paidAt && o.paidAt.slice(0, 7) === month) {
          paidThisMonthCents += o.amountCents;
        }
      } else if (isEffectivelyOverdue(o)) {
        overdueCents += o.amountCents;
      } else {
        pendingCents += o.amountCents;
      }
    }
    return { pendingCents, overdueCents, paidThisMonthCents };
  }, [obligations]);

  // ── Recurrence KPIs ───────────────────────────────────────────────────────────
  const recurrenceKpis = useMemo(() => {
    const now = new Date();
    const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const activeRecurrences = recurrences.filter((r) => r.status === "active");

    const dueSoon = activeRecurrences.filter((r) => {
      const d = nextDueDate(r.dayOfMonth);
      return d <= sevenDaysLater;
    }).length;

    const expectedThisMonth = activeRecurrences
      .filter((r) => {
        const d = nextDueDate(r.dayOfMonth);
        return (
          d.getFullYear() === now.getFullYear() &&
          d.getMonth() === now.getMonth()
        );
      })
      .reduce((sum, r) => sum + r.estimatedAmountCents, 0);

    return {
      activeCount: activeRecurrences.length,
      awaitingInvoice: summary?.awaitingInvoiceCount ?? 0,
      dueSoon,
      expectedThisMonth,
    };
  }, [recurrences, summary]);

  // ── Tab counts ────────────────────────────────────────────────────────────────
  const tabCounts = useMemo(
    () => ({
      recurrence: recurrences.length,
      manual: obligations.filter((o) => o.source === "manual").length,
    }),
    [obligations, recurrences],
  );

  // ── Filtered obligations ──────────────────────────────────────────────────────
  const filteredObligations = useMemo(() => {
    let list = obligations.filter((o) => o.source === activeTab);
    if (statusFilter) {
      list = list.filter((o) => {
        if (statusFilter === "overdue") return isEffectivelyOverdue(o);
        return o.status === statusFilter && !isEffectivelyOverdue(o);
      });
    }
    if (fromFilter) list = list.filter((o) => o.dueDate >= fromFilter);
    if (toFilter) list = list.filter((o) => o.dueDate <= toFilter);
    return list;
  }, [obligations, activeTab, statusFilter, fromFilter, toFilter]);

  // ── Filtered recurrences ──────────────────────────────────────────────────────
  const filteredRecurrences = useMemo(() => {
    let list = recurrences;
    if (recStatusFilter)
      list = list.filter((r) => r.status === recStatusFilter);
    if (recTypeFilter) list = list.filter((r) => r.type === recTypeFilter);
    if (recSearch) {
      const q = recSearch.toLowerCase();
      list = list.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.supplierName.toLowerCase().includes(q),
      );
    }
    return list;
  }, [recurrences, recStatusFilter, recTypeFilter, recSearch]);

  // ── Mutations ─────────────────────────────────────────────────────────────────
  const createManualMutation = useMutation({
    mutationFn: (payload: CreateManualObligationPayload) =>
      api.createManualObligation(payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["financial-obligations"] });
      setShowManualDrawer(false);
    },
  });

  const markPaidMutation = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: MarkObligationAsPaidPayload;
    }) => api.markAsPaid(id, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["financial-obligations"] });
      setMarkingPaid(null);
    },
  });

  const createRecurrenceMutation = useMutation({
    mutationFn: (payload: CreateRecurrencePayload) =>
      recurrencesApi.createRecurrence(payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["payable-recurrences"] });
    },
  });

  const pauseMutation = useMutation({
    mutationFn: (id: string) => recurrencesApi.pauseRecurrence(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["payable-recurrences"] });
      void qc.invalidateQueries({ queryKey: ["payable-recurrences-summary"] });
    },
  });

  const resumeMutation = useMutation({
    mutationFn: (id: string) => recurrencesApi.resumeRecurrence(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["payable-recurrences"] });
      void qc.invalidateQueries({ queryKey: ["payable-recurrences-summary"] });
    },
  });

  async function handleCreateRecurrence(
    payload: CreateRecurrencePayload,
    file: File | null,
  ) {
    const created = await createRecurrenceMutation.mutateAsync(payload);
    if (file) {
      setUploadingDoc(true);
      try {
        await recurrencesApi.uploadRecurrenceDocument(created.id, file);
        void qc.invalidateQueries({ queryKey: ["payable-recurrences"] });
      } finally {
        setUploadingDoc(false);
      }
    }
    setShowRecurrenceDrawer(false);
  }

  const isPauseResuming = pauseMutation.isPending || resumeMutation.isPending;

  return (
    <div className="min-h-screen bg-[#FAF6F3]">
      {/* Header */}
      <div className="border-b border-[#F5C992]/40 bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-stone-900">
              Obrigações Financeiras
            </h1>
            <p className="mt-0.5 text-sm text-stone-500">
              Pagamentos concretos pendentes — recorrências confirmadas e
              despesas avulsas
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowRecurrenceDrawer(true)}
              className="flex items-center gap-2 rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
            >
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-11.25a.75.75 0 00-1.5 0v2.5h-2.5a.75.75 0 000 1.5h2.5v2.5a.75.75 0 001.5 0v-2.5h2.5a.75.75 0 000-1.5h-2.5v-2.5z"
                  clipRule="evenodd"
                />
              </svg>
              Nova recorrência
            </button>
            <button
              onClick={() => setShowManualDrawer(true)}
              className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#ED5C32] to-[#EF8935] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
              </svg>
              Nova obrigação
            </button>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* KPIs — obligations */}
        {activeTab === "manual" && (
          <div className="grid grid-cols-3 gap-4">
            <KpiCard
              label="Total pendente"
              value={fromCents(obligationKpis.pendingCents)}
              sub="A vencer"
              accentClass="text-amber-700"
            />
            <KpiCard
              label="Total vencido"
              value={fromCents(obligationKpis.overdueCents)}
              sub={
                obligationKpis.overdueCents > 0 ? "Em atraso" : "Sem atrasos"
              }
              accentClass={
                obligationKpis.overdueCents > 0
                  ? "text-red-600"
                  : "text-stone-800"
              }
            />
            <KpiCard
              label="Pago este mês"
              value={fromCents(obligationKpis.paidThisMonthCents)}
              sub="Mês atual"
              accentClass="text-emerald-700"
            />
          </div>
        )}

        {/* KPIs — recurrences */}
        {activeTab === "recurrence" && (
          <div className="grid grid-cols-4 gap-4">
            <KpiCard
              label="Recorrências ativas"
              value={recurrenceKpis.activeCount}
              accentClass="text-emerald-700"
            />
            <KpiCard
              label="Aguardando fatura"
              value={recurrenceKpis.awaitingInvoice}
              accentClass={
                recurrenceKpis.awaitingInvoice > 0
                  ? "text-amber-700"
                  : "text-stone-800"
              }
            />
            <KpiCard
              label="A vencer nos próx. 7 dias"
              value={recurrenceKpis.dueSoon}
              accentClass={
                recurrenceKpis.dueSoon > 0 ? "text-red-600" : "text-stone-800"
              }
            />
            <KpiCard
              label="Valor previsto do mês"
              value={fromCents(recurrenceKpis.expectedThisMonth)}
              sub="Recorrências ativas"
              accentClass="text-stone-800"
            />
          </div>
        )}

        {/* Table card */}
        <div className="overflow-hidden rounded-xl border border-[#F5C992]/40 bg-white">
          {/* Tabs + filters row */}
          <div className="flex items-center gap-1 border-b border-[#F5C992]/40 px-4 pt-3">
            {(
              [
                { key: "recurrence", label: "Recorrências" },
                { key: "manual", label: "Manual" },
              ] as { key: Tab; label: string }[]
            ).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`relative flex items-center gap-1.5 px-3 pb-3 pt-1 text-sm font-medium transition-colors ${
                  activeTab === key
                    ? "text-[#ED5C32] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:rounded-t after:bg-[#ED5C32]"
                    : "text-stone-500 hover:text-stone-700"
                }`}
              >
                {label}
                <span
                  className={`rounded-full px-1.5 py-0.5 text-xs font-semibold ${
                    activeTab === key
                      ? "bg-[#ED5C32]/10 text-[#ED5C32]"
                      : "bg-stone-100 text-stone-400"
                  }`}
                >
                  {tabCounts[key]}
                </span>
              </button>
            ))}

            {/* Obligation filters */}
            {activeTab === "manual" && (
              <div className="ml-auto flex items-center gap-2 pb-2">
                <div className="relative">
                  <input
                    type="date"
                    value={fromFilter}
                    onChange={(e) => setFromFilter(e.target.value)}
                    title="Vencimento de"
                    className={`rounded-lg border bg-white px-2 py-1.5 text-xs focus:outline-none ${
                      fromFilter
                        ? "border-[#ED5C32] ring-1 ring-[#ED5C32]/30"
                        : "border-stone-200 focus:border-[#ED5C32]"
                    }`}
                  />
                  {fromFilter && (
                    <span className="pointer-events-none absolute -right-[2px] -top-[2px] h-2 w-2 rounded-full bg-[#ED5C32]" />
                  )}
                </div>
                <span className="text-xs text-stone-400">—</span>
                <div className="relative">
                  <input
                    type="date"
                    value={toFilter}
                    onChange={(e) => setToFilter(e.target.value)}
                    title="Vencimento até"
                    className={`rounded-lg border bg-white px-2 py-1.5 text-xs focus:outline-none ${
                      toFilter
                        ? "border-[#ED5C32] ring-1 ring-[#ED5C32]/30"
                        : "border-stone-200 focus:border-[#ED5C32]"
                    }`}
                  />
                  {toFilter && (
                    <span className="pointer-events-none absolute -right-[2px] -top-[2px] h-2 w-2 rounded-full bg-[#ED5C32]" />
                  )}
                </div>
                <div className="relative">
                  <select
                    value={statusFilter}
                    onChange={(e) =>
                      setStatusFilter(e.target.value as ObligationStatus | "")
                    }
                    className={`rounded-lg border bg-white px-2 py-1.5 text-xs focus:outline-none ${
                      statusFilter
                        ? "border-[#ED5C32] ring-1 ring-[#ED5C32]/30"
                        : "border-stone-200 focus:border-[#ED5C32]"
                    }`}
                  >
                    <option value="">Todos os estados</option>
                    <option value="pending">Pendente</option>
                    <option value="overdue">Vencido</option>
                    <option value="paid">Pago</option>
                    <option value="cancelled">Cancelado</option>
                  </select>
                  {statusFilter && (
                    <span className="pointer-events-none absolute -right-[2px] -top-[2px] h-2 w-2 rounded-full bg-[#ED5C32]" />
                  )}
                </div>
                {(fromFilter || toFilter || statusFilter) && (
                  <button
                    onClick={() => {
                      setFromFilter("");
                      setToFilter("");
                      setStatusFilter("");
                    }}
                    className="text-xs text-stone-400 hover:text-stone-600"
                  >
                    Limpar
                  </button>
                )}
              </div>
            )}

            {/* Recurrence filters */}
            {activeTab === "recurrence" && (
              <div className="ml-auto flex items-center gap-2 pb-2">
                <div className="relative">
                  <input
                    type="text"
                    value={recSearch}
                    onChange={(e) => setRecSearch(e.target.value)}
                    placeholder="Pesquisar nome ou fornecedor…"
                    className={`rounded-lg border bg-white px-2 py-1.5 text-xs focus:outline-none w-52 ${
                      recSearch
                        ? "border-[#ED5C32] ring-1 ring-[#ED5C32]/30"
                        : "border-stone-200 focus:border-[#ED5C32]"
                    }`}
                  />
                  {recSearch && (
                    <span className="pointer-events-none absolute -right-[2px] -top-[2px] h-2 w-2 rounded-full bg-[#ED5C32]" />
                  )}
                </div>
                <div className="relative">
                  <select
                    value={recStatusFilter}
                    onChange={(e) =>
                      setRecStatusFilter(
                        e.target.value as RecurrenceStatus | "",
                      )
                    }
                    className={`rounded-lg border bg-white px-2 py-1.5 text-xs focus:outline-none ${
                      recStatusFilter !== ""
                        ? "border-[#ED5C32] ring-1 ring-[#ED5C32]/30"
                        : "border-stone-200 focus:border-[#ED5C32]"
                    }`}
                  >
                    <option value="">Todos os estados</option>
                    {(
                      Object.entries(RECURRENCE_STATUS_LABELS) as [
                        RecurrenceStatus,
                        string,
                      ][]
                    ).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                  {recStatusFilter !== "" && (
                    <span className="pointer-events-none absolute -right-[2px] -top-[2px] h-2 w-2 rounded-full bg-[#ED5C32]" />
                  )}
                </div>
                <div className="relative">
                  <select
                    value={recTypeFilter}
                    onChange={(e) =>
                      setRecTypeFilter(e.target.value as RecurrenceType | "")
                    }
                    className={`rounded-lg border bg-white px-2 py-1.5 text-xs focus:outline-none ${
                      recTypeFilter
                        ? "border-[#ED5C32] ring-1 ring-[#ED5C32]/30"
                        : "border-stone-200 focus:border-[#ED5C32]"
                    }`}
                  >
                    <option value="">Todos os tipos</option>
                    {(
                      Object.entries(RECURRENCE_TYPE_LABELS) as [
                        RecurrenceType,
                        string,
                      ][]
                    ).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                  {recTypeFilter && (
                    <span className="pointer-events-none absolute -right-[2px] -top-[2px] h-2 w-2 rounded-full bg-[#ED5C32]" />
                  )}
                </div>
                {(recSearch || recStatusFilter !== "" || recTypeFilter) && (
                  <button
                    onClick={() => {
                      setRecSearch("");
                      setRecStatusFilter("");
                      setRecTypeFilter("");
                    }}
                    className="text-xs text-stone-400 hover:text-stone-600"
                  >
                    Limpar
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Table body */}
          {isLoading ? (
            <div className="py-16 text-center text-sm text-stone-400">
              A carregar…
            </div>
          ) : activeTab === "recurrence" ? (
            filteredRecurrences.length === 0 ? (
              <div className="py-16 text-center text-sm text-stone-400">
                Sem recorrências para mostrar.
              </div>
            ) : (
              <table className="min-w-full text-sm">
                <thead className="border-b border-[#F5C992]/40 bg-stone-50/60">
                  <tr>
                    {[
                      "Estado",
                      "Nome",
                      "Fornecedor",
                      "Tipo",
                      "Próximo Venc.",
                      "Valor Previsto",
                      "Método pag.",
                      "",
                    ].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone-500"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F5C992]/30">
                  {filteredRecurrences.map((r) => (
                    <RecurrenceRow
                      key={r.id}
                      recurrence={r}
                      isPauseResuming={isPauseResuming}
                      onView={() =>
                        navigate(
                          `/financial/obligations/payable-recurrences/${r.id}`,
                        )
                      }
                      onPause={() => pauseMutation.mutate(r.id)}
                      onResume={() => resumeMutation.mutate(r.id)}
                    />
                  ))}
                </tbody>
              </table>
            )
          ) : filteredObligations.length === 0 ? (
            <div className="py-16 text-center text-sm text-stone-400">
              Sem obrigações para mostrar.
            </div>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="border-b border-[#F5C992]/40 bg-stone-50/60">
                <tr>
                  {[
                    "Estado",
                    "Fornecedor",
                    "Descrição",
                    "Valor",
                    "Vencimento",
                    "Origem",
                    "",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone-500"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F5C992]/30">
                {filteredObligations.map((o) => (
                  <ObligationRow
                    key={o.id}
                    obligation={o}
                    markingPaidId={markingPaid?.id ?? null}
                    onMarkPaid={() => setMarkingPaid(o)}
                    onViewRecurrence={() =>
                      navigate(
                        `/financial/obligations/payable-recurrences/${o.recurrenceId}`,
                      )
                    }
                    onViewInvoice={() => navigate(`/financial/invoices`)}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>

        {!isLoading &&
          activeTab !== "recurrence" &&
          filteredObligations.length > 0 && (
            <p className="text-xs text-stone-400">
              {filteredObligations.length} resultado
              {filteredObligations.length !== 1 ? "s" : ""}
            </p>
          )}
        {!isLoading &&
          activeTab === "recurrence" &&
          filteredRecurrences.length > 0 && (
            <p className="text-xs text-stone-400">
              {filteredRecurrences.length} resultado
              {filteredRecurrences.length !== 1 ? "s" : ""}
            </p>
          )}
      </div>

      {/* RecurrenceDrawer — reutiliza o componente existente */}
      <RecurrenceDrawer
        open={showRecurrenceDrawer}
        editing={null}
        saving={createRecurrenceMutation.isPending || uploadingDoc}
        onClose={() => setShowRecurrenceDrawer(false)}
        onCreate={(payload, file) => {
          void handleCreateRecurrence(payload, file);
        }}
        onUpdate={() => {}}
      />

      {/* ManualObligationDrawer */}
      <ManualObligationDrawer
        open={showManualDrawer}
        saving={createManualMutation.isPending}
        onClose={() => setShowManualDrawer(false)}
        onCreate={(payload) => createManualMutation.mutate(payload)}
      />

      {/* MarkAsPaidModal */}
      {markingPaid && (
        <MarkAsPaidModal
          obligation={markingPaid}
          saving={markPaidMutation.isPending}
          onClose={() => setMarkingPaid(null)}
          onConfirm={(payload) =>
            markPaidMutation.mutate({ id: markingPaid.id, payload })
          }
        />
      )}

      <PageFooter />
    </div>
  );
}

// ── ObligationRow ──────────────────────────────────────────────────────────────

function ObligationRow({
  obligation: o,
  markingPaidId,
  onMarkPaid,
  onViewRecurrence,
  onViewInvoice,
}: {
  obligation: FinancialObligationDTO;
  markingPaidId: string | null;
  onMarkPaid: () => void;
  onViewRecurrence: () => void;
  onViewInvoice: () => void;
}) {
  const st = effectiveStatus(o);
  const canPay = st === "pending" || st === "overdue";

  return (
    <tr className="hover:bg-[#FDF8F5]">
      <td className="px-4 py-3">
        <StatusBadge obligation={o} />
      </td>
      <td className="px-4 py-3 text-stone-700 max-w-[140px]">
        <span className="block truncate">{o.supplierName || "—"}</span>
      </td>
      <td className="px-4 py-3 text-stone-600 max-w-[200px]">
        <span className="block truncate font-medium">{o.description}</span>
        {o.recurrenceName && (
          <span className="block text-xs text-stone-400 truncate">
            {o.recurrenceName}
          </span>
        )}
      </td>
      <td className="px-4 py-3 font-semibold text-stone-800 whitespace-nowrap">
        {fromCents(o.amountCents)}
        {o.paidAt && (
          <span className="block text-xs font-normal text-stone-400">
            pago em {formatDate(o.paidAt)}
          </span>
        )}
        {o.paymentMethod && (
          <span className="block text-xs font-normal text-stone-400">
            {PAYMENT_METHOD_LABELS[o.paymentMethod]}
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-stone-600 whitespace-nowrap">
        {formatDate(o.dueDate)}
      </td>
      <td className="px-4 py-3">
        <SourceBadge source={o.source} />
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1">
          {canPay && (
            <button
              onClick={onMarkPaid}
              disabled={markingPaidId === o.id}
              className="rounded px-2 py-1 text-xs font-medium text-emerald-600 hover:bg-emerald-50 disabled:opacity-50"
            >
              Pagar
            </button>
          )}
          {o.source === "recurrence" && o.recurrenceId && (
            <button
              onClick={onViewRecurrence}
              className="rounded px-2 py-1 text-xs text-stone-500 hover:bg-stone-100"
            >
              Recorrência
            </button>
          )}
          {o.invoiceId && (
            <button
              onClick={onViewInvoice}
              className="rounded px-2 py-1 text-xs text-stone-500 hover:bg-stone-100"
            >
              Fatura
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

// ── RecurrenceRow ──────────────────────────────────────────────────────────────

function RecurrenceRow({
  recurrence: r,
  isPauseResuming,
  onView,
  onPause,
  onResume,
}: {
  recurrence: RecurrenceDTO;
  isPauseResuming: boolean;
  onView: () => void;
  onPause: () => void;
  onResume: () => void;
}) {
  const due = nextDueDate(r.dayOfMonth);
  const dueDateStr = due.toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const dueDay = new Date(due);
  dueDay.setHours(0, 0, 0, 0);
  const days = Math.round((dueDay.getTime() - now.getTime()) / 86_400_000);
  const daysLabel =
    days === 0 ? "hoje" : days === 1 ? "amanhã" : `em ${days} dias`;

  return (
    <tr className="hover:bg-[#FDF8F5]">
      <td className="px-4 py-3">
        <RecurrenceStatusBadge status={r.status} />
      </td>
      <td className="px-4 py-3 font-medium text-stone-800 max-w-[160px]">
        <span className="block truncate">{r.name}</span>
      </td>
      <td className="px-4 py-3 text-stone-600 max-w-[140px]">
        <span className="block truncate">{r.supplierName || "—"}</span>
      </td>
      <td className="px-4 py-3 text-stone-600 whitespace-nowrap">
        {RECURRENCE_TYPE_LABELS[r.type]}
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        {r.status === "closed" ? (
          <span className="text-stone-400">—</span>
        ) : (
          <>
            <span className="block text-stone-700">{dueDateStr}</span>
            <span
              className={`text-xs ${
                days <= 7 && r.status === "active"
                  ? "text-red-500"
                  : "text-stone-400"
              }`}
            >
              {daysLabel}
            </span>
          </>
        )}
      </td>
      <td className="px-4 py-3 font-semibold text-stone-800 whitespace-nowrap">
        {fromCents(r.estimatedAmountCents)}
        <span className="block text-xs font-normal text-stone-400">
          {RECURRENCE_FREQUENCY_LABELS[r.frequency]}
        </span>
      </td>
      <td className="px-4 py-3 text-xs text-stone-500 whitespace-nowrap">
        {RECURRENCE_PAYMENT_METHOD_LABELS[r.paymentMethod]}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={onView}
            className="rounded px-2 py-1 text-xs text-stone-500 hover:bg-stone-100"
          >
            Ver
          </button>
          {r.status === "active" && (
            <button
              onClick={onPause}
              disabled={isPauseResuming}
              className="rounded px-2 py-1 text-xs text-amber-600 hover:bg-amber-50 disabled:opacity-50"
            >
              Pausar
            </button>
          )}
          {r.status === "paused" && (
            <button
              onClick={onResume}
              disabled={isPauseResuming}
              className="rounded px-2 py-1 text-xs text-emerald-600 hover:bg-emerald-50 disabled:opacity-50"
            >
              Retomar
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
