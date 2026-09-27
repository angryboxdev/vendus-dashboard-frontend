import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { useHrModule } from "../../hr.module.tsx";
import { AttendanceIssueDetailPanel } from "./AttendanceIssueDetailPanel.tsx";
import { MonthlyClosureBar } from "./MonthlyClosureBar.tsx";
import type { AttendanceIssueRow, AttendanceState } from "../../domain/entities/attendance-conference.ts";

type Tab = "conferencia" | "resumo" | "horas";

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

function StateBadge({ state }: { state: AttendanceState }) {
  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${STATE_STYLES[state]}`}>
      {STATE_LABELS[state]}
    </span>
  );
}

function formatMinutesShort(mins: number): string {
  return `${Math.round(mins / 60)}h`;
}

function issueKey(row: { shiftId: string | null; attendanceId: string | null }): string {
  return row.shiftId ? `shift:${row.shiftId}` : `att:${row.attendanceId}`;
}

/**
 * "Assiduidade" (Fase 2) — substitui `HrReportPage.tsx` (legacy). Só a aba
 * Conferência está funcional nesta ronda; Resumo mensal/Horas & saldos
 * completos ficam para a Fase B (task, secções 17/18) — mostrar dados
 * incompletos seria pior do que avisar que ainda não existem.
 */
export function AttendanceView() {
  const { api } = useHrModule();
  const [searchParams, setSearchParams] = useSearchParams();
  const now = new Date();
  const year = Number(searchParams.get("year")) || now.getFullYear();
  const month = Number(searchParams.get("month")) || now.getMonth() + 1;
  const tab = (searchParams.get("tab") as Tab | null) ?? "conferencia";
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

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

  const { data: issuesResult, isLoading } = useQuery({
    queryKey: ["hr-attendance-issues", year, month],
    queryFn: () => api.listAttendanceIssues(year, month),
  });

  const selectedRow: AttendanceIssueRow | undefined = issuesResult?.items.find((r) => issueKey(r) === selectedKey);

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
      <div className="border-b border-[#F5C992]/40 bg-white px-6 py-4">
        <h1 className="text-xl font-bold text-stone-900">Assiduidade</h1>
        <p className="mt-0.5 text-sm text-stone-500">Comparação entre o planeado e o realizado, com correção pelo gestor e fecho mensal.</p>
      </div>

      <div className="space-y-4 p-6">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <div className="rounded-xl border border-[#F5C992]/40 bg-white px-4 py-3 shadow-sm">
            <p className="text-xs font-medium text-stone-500">Turnos com pendência</p>
            <p className="mt-0.5 text-lg font-bold text-red-600">{kpis?.pendingCount ?? "—"}</p>
          </div>
          <div className="rounded-xl border border-[#F5C992]/40 bg-white px-4 py-3 shadow-sm">
            <p className="text-xs font-medium text-stone-500">Atrasos</p>
            <p className="mt-0.5 text-lg font-bold text-amber-600">{kpis?.lateCount ?? "—"}</p>
          </div>
          <div className="rounded-xl border border-[#F5C992]/40 bg-white px-4 py-3 shadow-sm">
            <p className="text-xs font-medium text-stone-500">Horas realizadas</p>
            <p className="mt-0.5 text-lg font-bold text-emerald-600">{kpis ? formatMinutesShort(kpis.actualMinutesTotal) : "—"}</p>
          </div>
          <div className="rounded-xl border border-[#F5C992]/40 bg-white px-4 py-3 shadow-sm">
            <p className="text-xs font-medium text-stone-500">Horas planeadas</p>
            <p className="mt-0.5 text-lg font-bold text-stone-800">{kpis ? formatMinutesShort(kpis.plannedMinutesTotal) : "—"}</p>
          </div>
          <div className="rounded-xl border border-[#F5C992]/40 bg-white px-4 py-3 shadow-sm">
            <p className="text-xs font-medium text-stone-500">Saldo total</p>
            <p className={`mt-0.5 text-lg font-bold ${(kpis?.balanceMinutes ?? 0) < 0 ? "text-red-600" : "text-emerald-600"}`}>
              {kpis ? formatMinutesShort(kpis.balanceMinutes) : "—"}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex gap-1 border-b border-transparent">
            {(
              [
                { key: "conferencia", label: "Conferência" },
                { key: "resumo", label: "Resumo mensal" },
                { key: "horas", label: "Horas & saldos" },
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

          <div className="flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-2 py-1">
            <button onClick={() => changeMonth(-1)} className="rounded px-2 py-1 text-stone-500 hover:bg-stone-100">
              ←
            </button>
            <span className="min-w-[9rem] text-center text-sm font-medium capitalize text-stone-700">{monthLabel}</span>
            <button onClick={() => changeMonth(1)} className="rounded px-2 py-1 text-stone-500 hover:bg-stone-100">
              →
            </button>
          </div>
        </div>

        {tab === "conferencia" && (
          <>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1fr]">
              <div className="rounded-xl border border-[#F5C992]/40 bg-white p-4">
                <h2 className="text-sm font-semibold text-stone-800">Pendências de assiduidade ({issuesResult?.items.length ?? 0})</h2>
                <p className="mb-3 text-xs text-stone-500">Turnos que requerem conferência e/ou correção.</p>
                {isLoading ? (
                  <p className="py-8 text-center text-sm text-stone-400">A carregar…</p>
                ) : !issuesResult || issuesResult.items.length === 0 ? (
                  <p className="py-8 text-center text-sm text-stone-400">Sem pendências neste período.</p>
                ) : (
                  <ul className="max-h-[28rem] space-y-1.5 overflow-y-auto">
                    {issuesResult.items.map((row) => {
                      const key = issueKey(row);
                      return (
                        <li key={key}>
                          <button
                            type="button"
                            onClick={() => setSelectedKey(key)}
                            className={`flex w-full items-center justify-between gap-2 rounded-lg border p-2.5 text-left transition-colors ${
                              selectedKey === key ? "border-[#ED5C32] bg-orange-50/60" : "border-stone-100 hover:bg-stone-50"
                            }`}
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-stone-800">{row.employeeName}</p>
                              <p className="truncate text-xs text-stone-500">
                                {row.periods.map((p) => (p.plannedStart && p.plannedEnd ? `${p.plannedStart}–${p.plannedEnd}` : "—")).join(" | ")}
                              </p>
                              <p className="truncate text-xs text-amber-600">⚠ {row.occurrenceLabel}</p>
                            </div>
                            <StateBadge state={row.state} />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              {detail ? (
                <AttendanceIssueDetailPanel issue={detail} onCorrected={() => setSelectedKey(null)} />
              ) : (
                <div className="flex items-center justify-center rounded-xl border border-dashed border-stone-200 bg-white p-8 text-sm text-stone-400">
                  Seleciona uma ocorrência à esquerda para ver o detalhe.
                </div>
              )}
            </div>

            <MonthlyClosureBar year={year} month={month} onGoToConference={() => updateParams({ tab: "conferencia" })} />
          </>
        )}

        {tab === "resumo" && (
          <div className="rounded-xl border border-dashed border-stone-200 bg-white p-8 text-center text-sm text-stone-400">
            Resumo mensal completo — em construção (próxima ronda).
          </div>
        )}

        {tab === "horas" && (
          <div className="rounded-xl border border-dashed border-stone-200 bg-white p-8 text-center text-sm text-stone-400">
            Horas & saldos completos — em construção (próxima ronda).
          </div>
        )}
      </div>
    </div>
  );
}
