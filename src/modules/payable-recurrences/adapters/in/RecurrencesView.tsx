import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usePayableRecurrencesModule } from "../../payable-recurrences.module.tsx";
import {
  type RecurrenceDTO,
  type RecurrenceStatus,
  type RecurrenceType,
  RECURRENCE_TYPE_LABELS,
  RECURRENCE_STATUS_LABELS,
  RECURRENCE_FREQUENCY_LABELS,
} from "../../domain/entities/recurrence.ts";
import { KpiCard } from "./KpiCard.tsx";
import { NewRecurrenceButton } from "./NewRecurrenceButton.tsx";
import { RecurrencesViewSwitch } from "./RecurrencesViewSwitch.tsx";
import { PageFooter } from "../../../../components/PageFooter.tsx";

// ── helpers ────────────────────────────────────────────────────────────────────

function fromCents(n: number): string {
  return (n / 100).toLocaleString("pt-PT", { style: "currency", currency: "EUR" });
}

function formatDate(s: string): string {
  const [y, m, d] = s.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

/** Como terminou (ou vai terminar) a recorrência — coluna «Fim» do histórico. */
function endLabel(r: RecurrenceDTO): { main: string; sub: string } {
  if (r.status === "closed") {
    return { main: r.closedAt ? formatDate(r.closedAt) : "—", sub: "Encerrada" };
  }
  if (r.status === "paused") {
    return { main: r.pausedAt ? formatDate(r.pausedAt) : "—", sub: "Pausada" };
  }
  if (r.endDate) return { main: formatDate(r.endDate), sub: "Fim previsto" };
  return { main: "—", sub: "Sem fim definido" };
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

// ── Main View ──────────────────────────────────────────────────────────────────

/**
 * Histórico de recorrências: todas (ativas, pausadas, encerradas) com quando
 * começaram e quando pararam. A vista predefinida da aba é a mensal
 * (RecurrencesMonthlyView); chega-se aqui pelo seletor «Do mês | Histórico».
 */
export function RecurrencesView() {
  const { api } = usePayableRecurrencesModule();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<RecurrenceStatus | "">("");
  const [typeFilter, setTypeFilter] = useState<RecurrenceType | "">("");

  const { data: recurrences = [], isLoading } = useQuery({
    queryKey: ["payable-recurrences"],
    queryFn: () => api.listRecurrences(),
  });

  // ── KPIs ────────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const count = (s: RecurrenceStatus) => recurrences.filter((r) => r.status === s).length;
    return {
      total: recurrences.length,
      active: count("active"),
      paused: count("paused"),
      closed: count("closed"),
    };
  }, [recurrences]);

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
    // Mais recentes primeiro (data de início).
    return [...list].sort((a, b) => b.startDate.localeCompare(a.startDate) || a.name.localeCompare(b.name));
  }, [recurrences, statusFilter, typeFilter, search]);

  // ── Mutations ────────────────────────────────────────────────────────────────
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
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-stone-900">
              Recorrências — histórico
            </h1>
            <p className="mt-0.5 text-sm text-stone-500">
              Todas as recorrências: quando começaram, foram pausadas ou encerradas
            </p>
          </div>
          <div className="flex items-center gap-2">
            <RecurrencesViewSwitch active="history" />
            <NewRecurrenceButton />
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <KpiCard label="Total" value={kpis.total} sub="Recorrências criadas" />
          <KpiCard label="Ativas" value={kpis.active} sub="Em vigor" accentClass="text-emerald-700" />
          <KpiCard
            label="Pausadas"
            value={kpis.paused}
            sub="Sem gerar ocorrências"
            accentClass={kpis.paused > 0 ? "text-amber-600" : "text-stone-800"}
          />
          <KpiCard label="Encerradas" value={kpis.closed} sub="Finalizadas" />
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
              placeholder="Pesquisar por nome, fornecedor ou colaborador…"
              className="rounded-lg border border-stone-300 bg-white pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-[#ED5C32] w-80"
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
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-b border-[#F5C992]/40 bg-stone-50/60">
                  <tr>
                    {[
                      "Estado",
                      "Nome",
                      "Fornecedor / colaborador",
                      "Tipo",
                      "Início",
                      "Fim",
                      "Valor Previsto",
                      "",
                    ].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone-500 whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F5C992]/30">
                  {filtered.map((r) => {
                    const end = endLabel(r);
                    const isPending =
                      pauseMutation.isPending && pauseMutation.variables === r.id;
                    const isResuming =
                      resumeMutation.isPending && resumeMutation.variables === r.id;

                    return (
                      <tr key={r.id} className="hover:bg-[#FDF8F5]">
                        <td className="px-4 py-3">
                          <StatusBadge status={r.status} />
                        </td>
                        <td className="px-4 py-3 font-medium text-stone-800 max-w-[180px]">
                          <span className="block truncate">{r.name}</span>
                        </td>
                        <td className="px-4 py-3 text-stone-600 max-w-[160px]">
                          <span className="block truncate">{r.supplierName}</span>
                          {r.employeeId && (
                            <span className="block text-xs text-stone-400">Colaborador</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-stone-500 text-xs">
                          {RECURRENCE_TYPE_LABELS[r.type]}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-stone-700">
                          {formatDate(r.startDate)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="block text-stone-700">{end.main}</span>
                          <span className="text-xs text-stone-400">{end.sub}</span>
                        </td>
                        <td className="px-4 py-3 font-semibold text-stone-800">
                          {fromCents(r.estimatedAmountCents)}
                          <span className="block text-xs font-normal text-stone-400">
                            {RECURRENCE_FREQUENCY_LABELS[r.frequency]}
                          </span>
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
                                navigate(`/financial/recurrences/${r.id}`)
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
            </div>
          )}
        </div>

        {!isLoading && filtered.length > 0 && (
          <p className="text-xs text-stone-400">
            {filtered.length} resultado{filtered.length !== 1 ? "s" : ""}
          </p>
        )}
      </div>

      <PageFooter />
    </div>
  );
}
