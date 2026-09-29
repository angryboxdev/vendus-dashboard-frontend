import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { useHrModule } from "../../hr.module.tsx";
import { useLocations } from "../../../locations/adapters/in/use-locations.ts";
import { AttendanceIssueResolutionModal } from "./AttendanceIssueResolutionModal.tsx";
import { AttendanceRulesModal } from "./AttendanceRulesModal.tsx";
import { AttendanceMonthlyClosureView } from "./AttendanceMonthlyClosureView.tsx";
import { formatMinutes } from "../../../../lib/format-minutes.ts";
import type { AttendanceIssueRow, AttendanceOccurrenceKind, AttendanceState } from "../../domain/entities/attendance-conference.ts";

type Tab = "conferencia" | "fechamento";
type ReviewFilter = "all" | "pending" | "conferred";
type DateFilter = "all" | "today" | "week";

const STATE_LABELS: Record<AttendanceState, string> = {
  REGULAR: "Regular",
  PRESENTE: "Presente",
  CONCLUIDO: "Concluído",
  PARCIAL: "Parcial",
  AUSENTE: "Ausente",
  EM_ABERTO: "Em aberto",
  CONFLITO: "Conflito",
};

const STATE_STYLES: Record<AttendanceState, string> = {
  REGULAR: "bg-stone-100 text-stone-600",
  PRESENTE: "bg-emerald-50 text-emerald-700",
  CONCLUIDO: "bg-emerald-50 text-emerald-700",
  PARCIAL: "bg-amber-50 text-amber-700",
  AUSENTE: "bg-red-50 text-red-600",
  EM_ABERTO: "bg-amber-50 text-amber-700",
  CONFLITO: "bg-red-100 text-red-800",
};

/** Filtros rápidos (task "Assiduidade — Conferência, Por Colaborador e Horas & Saldos", secção 4). */
const FILTER_CHIPS: { key: AttendanceOccurrenceKind; label: string }[] = [
  { key: "late_entry", label: "Atrasos" },
  { key: "absence", label: "Possíveis ausências" },
  { key: "no_entry", label: "Sem entrada" },
  { key: "no_exit", label: "Sem saída" },
  { key: "incomplete_period", label: "Turno incompleto" },
  { key: "early_exit", label: "Saída antecipada" },
  { key: "unscheduled_presence", label: "Presença sem escala" },
  { key: "conflict", label: "Conflitos" },
];

const OCCURRENCE_STYLES: Record<AttendanceOccurrenceKind, string> = {
  late_entry: "text-red-600",
  early_exit: "text-amber-600",
  no_entry: "text-red-600",
  no_exit: "text-amber-600",
  absence: "text-red-600",
  unscheduled_presence: "text-amber-600",
  conflict: "text-red-700",
  before_window: "text-amber-600",
  incomplete_period: "text-amber-600",
  ok: "text-emerald-600",
};

function issueKey(row: { shiftId: string | null; attendanceId: string | null }): string {
  return row.shiftId ? `shift:${row.shiftId}` : `att:${row.attendanceId}`;
}

function isInCurrentIsoWeek(workDate: string, today: Date): boolean {
  const d = new Date(`${workDate}T00:00:00`);
  const day = (today.getDay() + 6) % 7; // 0 = segunda
  const monday = new Date(today);
  monday.setDate(today.getDate() - day);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return d >= monday && d <= sunday;
}

/**
 * "Assiduidade" (task "Simplificar Assiduidade em Conferência + Fecho
 * Mensal") — reduzida a 2 abas: Conferência (fila de pendências) e Fecho
 * mensal (por colaborador + fechar/reabrir o período, fundidos numa só
 * aba — nunca 2 fluxos de resolução distintos, secção 6). "Horas &
 * saldos" foi removida por ser redundante com o que já aparece nas
 * outras 2 (secção 20). Conferência nunca mostra Horas planeadas/
 * realizadas/Saldo (esses vivem em Fecho mensal).
 */
export function AttendanceView() {
  const { api } = useHrModule();
  const { locations } = useLocations();
  const [searchParams, setSearchParams] = useSearchParams();
  const now = new Date();
  const year = Number(searchParams.get("year")) || now.getFullYear();
  const month = Number(searchParams.get("month")) || now.getMonth() + 1;
  const tab = (searchParams.get("tab") as Tab | null) ?? "conferencia";
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>("pending");
  const [activeFilter, setActiveFilter] = useState<AttendanceOccurrenceKind | "all">("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [search, setSearch] = useState(() => searchParams.get("q") ?? "");
  const [locationId, setLocationId] = useState("");
  const [rulesModalOpen, setRulesModalOpen] = useState(false);

  function updateParams(patch: Record<string, string | undefined>) {
    const next = new URLSearchParams(searchParams);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    setSearchParams(next);
  }

  function changeMonth(delta: number) {
    const d = new Date(year, month - 1 + delta, 1);
    updateParams({ year: String(d.getFullYear()), month: String(d.getMonth() + 1) });
    setSelectedKey(null);
  }

  const { data: issuesResult, isLoading, isError, error } = useQuery({
    queryKey: ["hr-attendance-issues", year, month, locationId],
    queryFn: () => api.listAttendanceIssues(year, month, locationId || undefined),
  });

  const items = useMemo(() => issuesResult?.items ?? [], [issuesResult]);

  const reviewCounts = useMemo(() => {
    let pending = 0;
    let conferred = 0;
    for (const row of items) {
      if (row.reviewStatus === "pending") pending++;
      else conferred++;
    }
    return { pending, conferred, all: items.length };
  }, [items]);

  const filterCounts = useMemo(() => {
    const counts: Partial<Record<AttendanceOccurrenceKind, number>> = {};
    for (const row of items) {
      if (reviewFilter !== "all" && row.reviewStatus !== reviewFilter) continue;
      counts[row.occurrenceKind] = (counts[row.occurrenceKind] ?? 0) + 1;
    }
    return counts;
  }, [items, reviewFilter]);

  const filteredItems = useMemo(() => {
    return items.filter((row) => {
      if (reviewFilter !== "all" && row.reviewStatus !== reviewFilter) return false;
      if (activeFilter !== "all" && row.occurrenceKind !== activeFilter) return false;
      if (dateFilter === "today" && row.workDate !== now.toISOString().slice(0, 10)) return false;
      if (dateFilter === "week" && !isInCurrentIsoWeek(row.workDate, now)) return false;
      if (search.trim() && !row.employeeName.toLowerCase().includes(search.trim().toLowerCase())) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, reviewFilter, activeFilter, dateFilter, search]);

  const selectedRow: AttendanceIssueRow | undefined = items.find((r) => issueKey(r) === selectedKey);

  const { data: detail } = useQuery({
    queryKey: ["hr-attendance-issue-detail", selectedRow?.workDate, selectedRow?.shiftId, selectedRow?.attendanceId],
    queryFn: () =>
      api.getAttendanceIssueDetail(selectedRow!.workDate, {
        ...(selectedRow!.shiftId && { shiftId: selectedRow!.shiftId }),
        ...(selectedRow!.attendanceId && !selectedRow!.shiftId && { attendanceId: selectedRow!.attendanceId }),
      }),
    enabled: !!selectedRow,
  });

  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString("pt-PT", { month: "long", year: "numeric" });
  const kpis = issuesResult?.kpis;

  return (
    <div className="flex min-h-full flex-col bg-[#FAF6F3]">
      <div className="flex items-center justify-between border-b border-[#F5C992]/40 bg-white px-6 py-4">
        <div>
          <h1 className="text-xl font-bold text-stone-900">Assiduidade</h1>
          <p className="mt-0.5 text-sm text-stone-500">Comparação entre o planeado e o realizado, com tolerâncias, conferência e fecho mensal.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-2 py-1">
            <button onClick={() => changeMonth(-1)} className="rounded px-2 py-1 text-stone-500 hover:bg-stone-100">
              ←
            </button>
            <span className="min-w-[9rem] text-center text-sm font-medium capitalize text-stone-700">{monthLabel}</span>
            <button onClick={() => changeMonth(1)} className="rounded px-2 py-1 text-stone-500 hover:bg-stone-100">
              →
            </button>
          </div>
          <button
            type="button"
            onClick={() => setRulesModalOpen(true)}
            className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-600 hover:bg-stone-50"
          >
            ⚙ Configurar regras
          </button>
        </div>
      </div>

      <div className="space-y-4 p-6">
        <div className="flex gap-1 border-b border-transparent">
          {(
            [
              { key: "conferencia", label: "Conferência" },
              { key: "fechamento", label: "Fecho mensal" },
            ] as { key: Tab; label: string }[]
          ).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => updateParams({ tab: key })}
              className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                tab === key ? "border-[#ED5C32] text-[#ED5C32]" : "border-transparent text-stone-500 hover:text-stone-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "conferencia" && (
          <>
            {isError ? (
              <p className="text-sm text-stone-400">Indisponível — não foi possível carregar os indicadores.</p>
            ) : (
              <p className="text-sm text-stone-500">
                <span className="font-semibold text-red-600">{kpis?.pendingCount ?? 0}</span> por conferir ·{" "}
                <span className="font-semibold text-stone-800">{kpis?.possibleAbsencesCount ?? 0}</span> possíveis ausências ·{" "}
                <span className="font-semibold text-amber-600">{kpis?.noExitCount ?? 0}</span> sem saída ·{" "}
                <span className="font-semibold text-red-700">{kpis?.conflictsCount ?? 0}</span> conflitos
              </p>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex rounded-lg border border-stone-200 bg-white p-0.5 text-sm">
                {(
                  [
                    { key: "pending", label: `Por conferir (${reviewCounts.pending})` },
                    { key: "conferred", label: `Resolvidos (${reviewCounts.conferred})` },
                    { key: "all", label: `Todos (${reviewCounts.all})` },
                  ] as { key: ReviewFilter; label: string }[]
                ).map(({ key, label }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setReviewFilter(key)}
                    className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
                      reviewFilter === key ? "bg-stone-800 text-white" : "text-stone-500 hover:bg-stone-100"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1 rounded-lg border border-stone-200 bg-white p-0.5 text-xs">
                {(
                  [
                    { key: "all", label: "Este mês" },
                    { key: "week", label: "Esta semana" },
                    { key: "today", label: "Hoje" },
                  ] as { key: DateFilter; label: string }[]
                ).map(({ key, label }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setDateFilter(key)}
                    className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                      dateFilter === key ? "bg-stone-800 text-white" : "text-stone-500 hover:bg-stone-100"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveFilter("all")}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  activeFilter === "all" ? "bg-stone-800 text-white" : "bg-white text-stone-600 hover:bg-stone-100"
                } border border-stone-200`}
              >
                Todos {Object.values(filterCounts).reduce((a, b) => a + b, 0)}
              </button>
              {FILTER_CHIPS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setActiveFilter(f.key)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    activeFilter === f.key ? "bg-stone-800 text-white" : "bg-white text-stone-600 hover:bg-stone-100"
                  } border border-stone-200`}
                >
                  {f.label} {filterCounts[f.key] ?? 0}
                </button>
              ))}

              <div className="ml-auto flex items-center gap-2">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Pesquisar por nome..."
                  className="w-56 rounded-md border border-stone-300 bg-white py-1.5 px-3 text-sm text-stone-700 outline-none focus:border-[#ED5C32]"
                />
                {locations.length > 1 && (
                  <select
                    value={locationId}
                    onChange={(e) => setLocationId(e.target.value)}
                    className="rounded-md border border-stone-300 bg-white py-1.5 px-3 text-sm text-stone-700 outline-none focus:border-[#ED5C32]"
                  >
                    <option value="">Todos os locais</option>
                    {locations.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-[#F5C992]/40 bg-white">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-100 text-left text-xs font-medium uppercase text-stone-400">
                    <th className="px-4 py-2.5">Data</th>
                    <th className="px-4 py-2.5">Colaborador</th>
                    <th className="px-4 py-2.5">Planeado</th>
                    <th className="px-4 py-2.5">Registado</th>
                    <th className="px-4 py-2.5">Ocorrência</th>
                    <th className="px-4 py-2.5">Impacto</th>
                    <th className="px-4 py-2.5">Estado</th>
                    <th className="px-4 py-2.5">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-stone-400">
                        A carregar…
                      </td>
                    </tr>
                  ) : isError ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-red-500" title={error instanceof Error ? error.message : undefined}>
                        Não foi possível carregar a Conferência.
                      </td>
                    </tr>
                  ) : filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-stone-400">
                        Sem ocorrências para este filtro.
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((row) => {
                      const key = issueKey(row);
                      const isConferred = row.reviewStatus === "conferred";
                      return (
                        <tr key={key} className="border-b border-stone-50 last:border-0 hover:bg-stone-50/60">
                          <td className="px-4 py-2.5 text-stone-600">
                            {new Date(`${row.workDate}T00:00:00`).toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric" })}
                          </td>
                          <td className="px-4 py-2.5 font-medium text-stone-800">{row.employeeName}</td>
                          <td className="px-4 py-2.5 text-stone-600">
                            {row.periods.map((p) => (p.plannedStart && p.plannedEnd ? `${p.plannedStart}–${p.plannedEnd}` : "—")).join(" | ")}
                          </td>
                          <td className="px-4 py-2.5 text-stone-600">
                            {row.periods.map((p) => (p.actualStart && p.actualEnd ? `${p.actualStart}–${p.actualEnd}` : p.actualStart ? `${p.actualStart}–` : "—")).join(" | ")}
                          </td>
                          <td className={`px-4 py-2.5 font-medium ${OCCURRENCE_STYLES[row.occurrenceKind]}`}>{row.occurrenceLabel}</td>
                          <td className={`px-4 py-2.5 ${row.diffMinutes == null ? "text-stone-400" : row.diffMinutes < 0 ? "text-red-600" : "text-emerald-600"}`}>
                            {row.diffMinutes == null ? "—" : formatMinutes(row.diffMinutes)}
                          </td>
                          <td className="px-4 py-2.5">
                            <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${isConferred ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                              {isConferred ? "Conferido" : "Pendente"}
                            </span>
                            <span className={`ml-1.5 inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ${STATE_STYLES[row.state]}`}>
                              {STATE_LABELS[row.state]}
                            </span>
                          </td>
                          <td className="px-4 py-2.5">
                            <button
                              type="button"
                              onClick={() => setSelectedKey(key)}
                              className="rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50"
                            >
                              {isConferred ? "Ver" : "Resolver"}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {tab === "fechamento" && (
          <AttendanceMonthlyClosureView year={year} month={month} locationId={locationId} onLocationChange={setLocationId} />
        )}
      </div>

      {detail && (
        <AttendanceIssueResolutionModal
          issue={detail}
          onClose={() => setSelectedKey(null)}
          onCorrected={() => setSelectedKey(null)}
        />
      )}

      {rulesModalOpen && <AttendanceRulesModal onClose={() => setRulesModalOpen(false)} />}
    </div>
  );
}
