import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usePayableRecurrencesModule } from "../../payable-recurrences.module.tsx";
import {
  type RecurrenceDTO,
  type RecurrenceStatus,
  type RecurrenceType,
  type CreateRecurrencePayload,
  type UpdateRecurrencePayload,
  RECURRENCE_TYPE_LABELS,
  RECURRENCE_STATUS_LABELS,
  RECURRENCE_FREQUENCY_LABELS,
  PAYMENT_METHOD_LABELS,
  nextDueDate,
} from "../../domain/entities/recurrence.ts";
import { RecurrenceDrawer } from "./RecurrenceDrawer.tsx";
import { PageFooter } from "../../../../components/PageFooter.tsx";

// ── helpers ────────────────────────────────────────────────────────────────────

function fromCents(n: number): string {
  return (n / 100).toLocaleString("pt-PT", { style: "currency", currency: "EUR" });
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function daysUntil(d: Date): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / 86_400_000);
}

// ── StatusBadge ────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<RecurrenceStatus, string> = {
  active: "bg-emerald-50 text-emerald-700",
  paused: "bg-amber-50 text-amber-700",
  closed: "bg-stone-100 text-stone-500",
};

const STATUS_DOT: Record<RecurrenceStatus, string> = {
  active: "bg-emerald-500",
  paused: "bg-amber-500",
  closed: "bg-stone-400",
};

function StatusBadge({ status }: { status: RecurrenceStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[status]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[status]}`} />
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

// ── Main View ──────────────────────────────────────────────────────────────────

export function RecurrencesView() {
  const { api } = usePayableRecurrencesModule();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<RecurrenceStatus | "">("");
  const [typeFilter, setTypeFilter] = useState<RecurrenceType | "">("");
  const [showDrawer, setShowDrawer] = useState(false);
  const [uploading, setUploading] = useState(false);

  const { data: recurrences = [], isLoading } = useQuery({
    queryKey: ["payable-recurrences"],
    queryFn: () => api.listRecurrences(),
  });

  const { data: summary } = useQuery({
    queryKey: ["payable-recurrences-summary"],
    queryFn: () => api.getSummary(),
  });

  // ── KPIs (derived client-side + summary from API) ───────────────────────────
  const kpis = useMemo(() => {
    const now = new Date();
    const in7Days = new Date(now);
    in7Days.setDate(in7Days.getDate() + 7);

    const active = recurrences.filter((r) => r.status === "active");
    const dueSoon = active.filter((r) => {
      const nd = nextDueDate(r.dayOfMonth);
      return nd <= in7Days;
    });
    const totalEstimated = active.reduce((s, r) => s + r.estimatedAmountCents, 0);

    return {
      activeCount: active.length,
      awaitingInvoiceCount: summary?.awaitingInvoiceCount ?? 0,
      dueSoonCount: dueSoon.length,
      totalEstimated,
    };
  }, [recurrences, summary]);

  // ── Filters ─────────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = recurrences;
    if (statusFilter) list = list.filter((r) => r.status === statusFilter);
    if (typeFilter) list = list.filter((r) => r.type === typeFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.supplierName.toLowerCase().includes(q),
      );
    }
    return list;
  }, [recurrences, statusFilter, typeFilter, search]);

  // ── Mutations ────────────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (payload: CreateRecurrencePayload) => api.createRecurrence(payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["payable-recurrences"] });
    },
  });

  async function handleCreate(
    payload: CreateRecurrencePayload,
    file: File | null,
  ) {
    const created = await createMutation.mutateAsync(payload);
    if (file) {
      setUploading(true);
      try {
        await api.uploadRecurrenceDocument(created.id, file);
        void qc.invalidateQueries({ queryKey: ["payable-recurrences"] });
      } finally {
        setUploading(false);
      }
    }
    setShowDrawer(false);
  }

  const pauseMutation = useMutation({
    mutationFn: (id: string) => api.pauseRecurrence(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["payable-recurrences"] }),
  });

  const resumeMutation = useMutation({
    mutationFn: (id: string) => api.resumeRecurrence(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["payable-recurrences"] }),
  });

  return (
    <div className="min-h-screen bg-[#FAF6F3]">
      {/* Header */}
      <div className="border-b border-[#F5C992]/40 bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-stone-900">
              Recorrências &amp; Contratos
            </h1>
            <p className="mt-0.5 text-sm text-stone-500">
              Gestão de compromissos recorrentes, contratos e faturas associadas
            </p>
          </div>
          <button
            onClick={() => setShowDrawer(true)}
            className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#ED5C32] to-[#EF8935] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
            </svg>
            Nova recorrência
          </button>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <KpiCard
            label="Ativas"
            value={kpis.activeCount}
            sub="Em vigor"
            accentClass="text-emerald-700"
          />
          <KpiCard
            label="Aguardando fatura"
            value={kpis.awaitingInvoiceCount}
            sub={kpis.awaitingInvoiceCount > 0 ? "Ocorrências por faturar" : "Nenhuma pendente"}
            accentClass={kpis.awaitingInvoiceCount > 0 ? "text-amber-600" : "text-stone-800"}
          />
          <KpiCard
            label="A vencer nos próximos 7 dias"
            value={kpis.dueSoonCount}
            sub="A vencer"
            accentClass={kpis.dueSoonCount > 0 ? "text-red-600" : "text-stone-800"}
          />
          <KpiCard
            label="Valor previsto do mês"
            value={fromCents(kpis.totalEstimated)}
            sub="Total estimado"
          />
        </div>

        {/* Filters */}
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
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Pesquisar por nome ou fornecedor…"
              className="rounded-lg border border-stone-300 bg-white pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-[#ED5C32] w-72"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as RecurrenceStatus | "")}
            className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus:outline-none focus:border-[#ED5C32]"
          >
            <option value="">Todos os estados</option>
            <option value="active">Ativa</option>
            <option value="paused">Pausada</option>
            <option value="closed">Encerrada</option>
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as RecurrenceType | "")}
            className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus:outline-none focus:border-[#ED5C32]"
          >
            <option value="">Todos os tipos</option>
            {(Object.entries(RECURRENCE_TYPE_LABELS) as [RecurrenceType, string][]).map(
              ([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ),
            )}
          </select>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-xl border border-[#F5C992]/40 bg-white">
          {isLoading ? (
            <div className="py-16 text-center text-sm text-stone-400">A carregar…</div>
          ) : filtered.length === 0 ? (
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
                {filtered.map((r) => {
                  const nd = nextDueDate(r.dayOfMonth);
                  const days = daysUntil(nd);
                  const isPending =
                    pauseMutation.isPending && pauseMutation.variables === r.id;
                  const isResuming =
                    resumeMutation.isPending && resumeMutation.variables === r.id;

                  return (
                    <tr key={r.id} className="hover:bg-[#FDF8F5]">
                      <td className="px-4 py-3">
                        <StatusBadge status={r.status} />
                      </td>
                      <td className="px-4 py-3 font-medium text-stone-800 max-w-[160px]">
                        <span className="block truncate">{r.name}</span>
                      </td>
                      <td className="px-4 py-3 text-stone-600 max-w-[140px]">
                        <span className="block truncate">{r.supplierName}</span>
                      </td>
                      <td className="px-4 py-3 text-stone-500 text-xs">
                        {RECURRENCE_TYPE_LABELS[r.type]}
                      </td>
                      <td className="px-4 py-3">
                        <span className="block text-stone-700">{formatDate(nd)}</span>
                        <span
                          className={`text-xs ${
                            days <= 7 && r.status === "active"
                              ? "text-red-500"
                              : "text-stone-400"
                          }`}
                        >
                          {days === 0
                            ? "hoje"
                            : days === 1
                            ? "amanhã"
                            : `em ${days} dias`}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-stone-800">
                        {fromCents(r.estimatedAmountCents)}
                        <span className="block text-xs font-normal text-stone-400">
                          {RECURRENCE_FREQUENCY_LABELS[r.frequency]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-stone-500">
                        {PAYMENT_METHOD_LABELS[r.paymentMethod]}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {r.status === "active" && (
                            <button
                              onClick={() => pauseMutation.mutate(r.id)}
                              disabled={isPending}
                              className="rounded px-2 py-1 text-xs text-amber-600 hover:bg-amber-50 disabled:opacity-50"
                            >
                              {isPending ? "…" : "Pausar"}
                            </button>
                          )}
                          {r.status === "paused" && (
                            <button
                              onClick={() => resumeMutation.mutate(r.id)}
                              disabled={isResuming}
                              className="rounded px-2 py-1 text-xs text-emerald-600 hover:bg-emerald-50 disabled:opacity-50"
                            >
                              {isResuming ? "…" : "Retomar"}
                            </button>
                          )}
                          <button
                            onClick={() =>
                              navigate(`/financial/payable-recurrences/${r.id}`)
                            }
                            className="rounded px-2 py-1 text-xs font-medium text-[#ED5C32] hover:bg-orange-50"
                          >
                            Ver
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {!isLoading && filtered.length > 0 && (
          <p className="text-xs text-stone-400">
            {filtered.length} resultado{filtered.length !== 1 ? "s" : ""}
          </p>
        )}
      </div>

      <RecurrenceDrawer
        open={showDrawer}
        editing={null}
        saving={createMutation.isPending || uploading}
        onClose={() => setShowDrawer(false)}
        onCreate={(payload, file) => { void handleCreate(payload, file); }}
        onUpdate={() => {}}
      />

      <PageFooter />
    </div>
  );
}
