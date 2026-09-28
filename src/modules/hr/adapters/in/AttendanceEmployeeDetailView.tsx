import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useHrModule } from "../../hr.module.tsx";
import { AttendanceIssueResolutionModal } from "./AttendanceIssueResolutionModal.tsx";
import { formatMinutes, formatMinutesAsWholeHours } from "../../../../lib/format-minutes.ts";
import type { AttendanceIssueRow, AttendanceOccurrenceKind, AttendanceState } from "../../domain/entities/attendance-conference.ts";

type RowFilter = "all" | "pending" | "late" | "absence" | "conferred";

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

function KpiCard({ label, value, valueCls = "text-stone-800" }: { label: string; value: string | number; valueCls?: string }) {
  return (
    <div className="rounded-xl border border-[#F5C992]/40 bg-white px-4 py-3 shadow-sm">
      <p className="text-xs font-medium text-stone-500">{label}</p>
      <p className={`mt-0.5 text-lg font-bold ${valueCls}`}>{value}</p>
    </div>
  );
}

/**
 * "Assiduidade — Nome" (task "Assiduidade — Conferência, Por Colaborador
 * e Horas & Saldos", secções 18/19) — ficha individual: KPIs do
 * colaborador + extrato diário completo (nunca pula "Regular", ao
 * contrário da Conferência). Uma pendência aqui reutiliza o MESMO
 * workflow `Resolver` da Conferência geral (`AttendanceIssueResolutionModal`)
 * — nunca duplica a lógica de resolução (secção 19, literal).
 */
export function AttendanceEmployeeDetailView() {
  const { api } = useHrModule();
  const { employeeId } = useParams<{ employeeId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const now = new Date();
  const year = Number(searchParams.get("year")) || now.getFullYear();
  const month = Number(searchParams.get("month")) || now.getMonth() + 1;
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [rowFilter, setRowFilter] = useState<RowFilter>("all");

  function changeMonth(delta: number) {
    const d = new Date(year, month - 1 + delta, 1);
    const next = new URLSearchParams(searchParams);
    next.set("year", String(d.getFullYear()));
    next.set("month", String(d.getMonth() + 1));
    setSearchParams(next);
    setSelectedKey(null);
  }

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["hr-attendance-employee-detail", employeeId, year, month],
    queryFn: () => api.getEmployeeAttendanceDetail(employeeId!, year, month),
    enabled: !!employeeId,
  });

  const filteredRows = useMemo(() => {
    if (!data) return [];
    return data.rows.filter((row) => {
      switch (rowFilter) {
        case "pending":
          return row.reviewStatus === "pending";
        case "conferred":
          return row.reviewStatus === "conferred";
        case "late":
          return row.occurrenceKind === "late_entry";
        case "absence":
          return row.occurrenceKind === "absence";
        default:
          return true;
      }
    });
  }, [data, rowFilter]);

  const selectedRow: AttendanceIssueRow | undefined = data?.rows.find((r) => issueKey(r) === selectedKey);

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

  return (
    <div className="flex min-h-full flex-col bg-[#FAF6F3]">
      <div className="border-b border-[#F5C992]/40 bg-white px-6 py-4">
        <nav className="mb-2 flex items-center gap-1.5 text-sm text-stone-400">
          <Link to="/hr/assiduidade" className="hover:text-stone-700 hover:underline">
            Assiduidade
          </Link>
          <span>/</span>
          <Link to="/hr/assiduidade?tab=colaborador" className="hover:text-stone-700 hover:underline">
            Por colaborador
          </Link>
          <span>/</span>
          <span className="truncate font-medium text-stone-700">{data?.employeeName ?? "…"}</span>
        </nav>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-stone-900">Assiduidade — {data?.employeeName ?? "…"}</h1>
            <p className="mt-0.5 text-sm capitalize text-stone-500">{monthLabel}</p>
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
            <Link to="/hr/assiduidade?tab=colaborador" className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-600 hover:bg-stone-50">
              ← Voltar ao resumo
            </Link>
          </div>
        </div>
      </div>

      <div className="space-y-4 p-6">
        {isLoading ? (
          <p className="py-8 text-center text-sm text-stone-400">A carregar…</p>
        ) : isError || !data ? (
          <div className="rounded-xl border border-dashed border-stone-200 bg-white p-8 text-center text-sm text-stone-400" title={error instanceof Error ? error.message : undefined}>
            Não foi possível carregar a assiduidade deste colaborador.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
              <KpiCard label="Turnos planeados" value={data.kpis.plannedShiftsCount} />
              <KpiCard label="Turnos realizados" value={data.kpis.actualShiftsCount} valueCls="text-emerald-600" />
              <KpiCard label="Pendências" value={data.kpis.pendingCount} valueCls="text-red-600" />
              <KpiCard label="Dias com atraso" value={data.kpis.lateDaysCount} valueCls="text-amber-600" />
              <KpiCard label="Horas em atraso" value={formatMinutes(data.kpis.lateMinutesTotal)} valueCls="text-red-600" />
              <KpiCard label="Ausências" value={data.kpis.absenceDaysCount} />
              <KpiCard label="Horas planeadas" value={formatMinutesAsWholeHours(data.kpis.plannedMinutes)} />
              <KpiCard label="Horas realizadas confirmadas" value={formatMinutesAsWholeHours(data.kpis.actualMinutesConfirmed)} valueCls="text-emerald-600" />
              <KpiCard
                label="Saldo confirmado"
                value={formatMinutes(data.kpis.balanceConfirmed)}
                valueCls={data.kpis.balanceConfirmed < 0 ? "text-red-600" : "text-emerald-600"}
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {(
                [
                  { key: "all", label: "Todos" },
                  { key: "pending", label: "Pendentes" },
                  { key: "late", label: "Atrasos" },
                  { key: "absence", label: "Ausências" },
                  { key: "conferred", label: "Conferidos" },
                ] as { key: RowFilter; label: string }[]
              ).map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setRowFilter(key)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    rowFilter === key ? "bg-stone-800 text-white" : "bg-white text-stone-600 hover:bg-stone-100"
                  } border border-stone-200`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="overflow-x-auto rounded-xl border border-[#F5C992]/40 bg-white">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-100 text-left text-xs font-medium uppercase text-stone-400">
                    <th className="px-4 py-2.5">Data</th>
                    <th className="px-4 py-2.5">Planeado</th>
                    <th className="px-4 py-2.5">Registado</th>
                    <th className="px-4 py-2.5">Resultado</th>
                    <th className="px-4 py-2.5">Estado</th>
                    <th className="px-4 py-2.5">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-stone-400">
                        Sem turnos para este filtro.
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((row) => {
                      const key = issueKey(row);
                      const isConferred = row.reviewStatus === "conferred";
                      return (
                        <tr key={key} className="border-b border-stone-50 last:border-0 hover:bg-stone-50/60">
                          <td className="px-4 py-2.5 text-stone-600">
                            {new Date(`${row.workDate}T00:00:00`).toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric" })}
                          </td>
                          <td className="px-4 py-2.5 text-stone-600">
                            {row.periods.map((p) => (p.plannedStart && p.plannedEnd ? `${p.plannedStart}–${p.plannedEnd}` : "—")).join(" | ")}
                          </td>
                          <td className="px-4 py-2.5 text-stone-600">
                            {row.periods.map((p) => (p.actualStart && p.actualEnd ? `${p.actualStart}–${p.actualEnd}` : p.actualStart ? `${p.actualStart}–` : "—")).join(" | ")}
                          </td>
                          <td className={`px-4 py-2.5 font-medium ${OCCURRENCE_STYLES[row.occurrenceKind]}`}>{row.occurrenceLabel}</td>
                          <td className="px-4 py-2.5">
                            <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${isConferred ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                              {isConferred ? "Conferido" : "Pendente"}
                            </span>
                            <span className={`ml-1.5 inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ${STATE_STYLES[row.state]}`}>
                              {STATE_LABELS[row.state]}
                            </span>
                          </td>
                          <td className="px-4 py-2.5">
                            {row.occurrenceKind === "ok" ? (
                              <span className="text-xs text-stone-300">—</span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setSelectedKey(key)}
                                className="rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50"
                              >
                                {isConferred ? "Ver" : "Resolver"}
                              </button>
                            )}
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
      </div>

      {detail && <AttendanceIssueResolutionModal issue={detail} onClose={() => setSelectedKey(null)} onCorrected={() => setSelectedKey(null)} />}
    </div>
  );
}
