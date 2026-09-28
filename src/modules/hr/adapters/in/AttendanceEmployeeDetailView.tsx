import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useHrModule } from "../../hr.module.tsx";
import { AttendanceIssueResolutionModal } from "./AttendanceIssueResolutionModal.tsx";
import { formatMinutes, formatMinutesAsWholeHours } from "../../../../lib/format-minutes.ts";
import { JOB_ROLE_LABELS } from "../../domain/entities/employee.ts";
import type { AttendanceIssueRow, AttendanceOccurrenceKind } from "../../domain/entities/attendance-conference.ts";

const PENDING_PAGE_SIZE = 8;

/** Redesign do Fecho Mensal, secção 15 — categoria grosseira da ocorrência, para a coluna "Tipo" da lista de pendências (mais legível que `occurrenceKind` cru). */
const OCCURRENCE_TYPE_LABEL: Record<AttendanceOccurrenceKind, string> = {
  late_entry: "Atraso",
  early_exit: "Saída antecipada",
  no_entry: "Falta de marcação",
  no_exit: "Falta de marcação",
  absence: "Ausência",
  unscheduled_presence: "Presença sem escala",
  conflict: "Conflito",
  before_window: "Fora do período",
  incomplete_period: "Turno incompleto",
  ok: "—",
};

function issueKey(row: { shiftId: string | null; attendanceId: string | null }): string {
  return row.shiftId ? `shift:${row.shiftId}` : `att:${row.attendanceId}`;
}

function plannedLabel(row: AttendanceIssueRow): string {
  return row.periods.map((p) => (p.plannedStart && p.plannedEnd ? `${p.plannedStart}–${p.plannedEnd}` : "—")).join(" | ");
}

/**
 * "Fecho mensal — {Nome}" (redesign completo, ver
 * `docs`/README do módulo) — responde só "o que falta resolver para
 * fechar este colaborador?", ao contrário da versão anterior (extrato
 * diário completo + 9 KPIs, que duplicava a Conferência). Mostra APENAS
 * as pendências (`reviewStatus: "pending"`), nunca os turnos "Regular"
 * já cumpridos — quem quiser o extrato completo usa "Ver conferência
 * completa". Resolver uma pendência reutiliza o MESMO
 * `AttendanceIssueResolutionModal` da Conferência — nunca duplica o
 * workflow de resolução.
 */
export function AttendanceEmployeeDetailView() {
  const { api } = useHrModule();
  const { employeeId } = useParams<{ employeeId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const now = new Date();
  const year = Number(searchParams.get("year")) || now.getFullYear();
  const month = Number(searchParams.get("month")) || now.getMonth() + 1;
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [showAllPending, setShowAllPending] = useState(false);

  function changeMonth(delta: number) {
    const d = new Date(year, month - 1 + delta, 1);
    const next = new URLSearchParams(searchParams);
    next.set("year", String(d.getFullYear()));
    next.set("month", String(d.getMonth() + 1));
    setSearchParams(next);
    setSelectedKey(null);
    setShowAllPending(false);
  }

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["hr-attendance-employee-detail", employeeId, year, month],
    queryFn: () => api.getEmployeeAttendanceDetail(employeeId!, year, month),
    enabled: !!employeeId,
  });

  const { data: closure } = useQuery({
    queryKey: ["hr-attendance-closure", year, month],
    queryFn: () => api.getMonthlyClosureStatus(year, month),
  });

  const pendingRows = useMemo(() => (data ? data.rows.filter((r) => r.reviewStatus === "pending") : []), [data]);
  const visiblePending = showAllPending ? pendingRows : pendingRows.slice(0, PENDING_PAGE_SIZE);

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

  /** Loja mais frequente entre os turnos deste colaborador este mês — só client-side, sem endpoint novo (secção 13). */
  const primaryLocationName = useMemo(() => {
    if (!data) return null;
    const counts = new Map<string, number>();
    for (const r of data.rows) {
      if (!r.locationName) continue;
      counts.set(r.locationName, (counts.get(r.locationName) ?? 0) + 1);
    }
    let best: string | null = null;
    let bestCount = 0;
    for (const [name, count] of counts) {
      if (count > bestCount) {
        best = name;
        bestCount = count;
      }
    }
    return best;
  }, [data]);

  const isClosed = closure?.status === "closed";
  const conferenceSearchHref = data ? `/hr/assiduidade?tab=conferencia&q=${encodeURIComponent(data.employeeName)}` : "/hr/assiduidade?tab=conferencia";

  return (
    <div className="flex min-h-full flex-col bg-[#FAF6F3]">
      <div className="border-b border-stone-200 bg-white px-6 py-4">
        <nav className="mb-2 flex items-center gap-1.5 text-sm text-stone-400">
          <Link to="/hr/assiduidade" className="hover:text-stone-700 hover:underline">
            Assiduidade
          </Link>
          <span>/</span>
          <Link to="/hr/assiduidade?tab=fechamento" className="hover:text-stone-700 hover:underline">
            Fecho mensal
          </Link>
          <span>/</span>
          <span className="truncate font-medium text-stone-700">{data?.employeeName ?? "…"}</span>
        </nav>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-stone-900">{data?.employeeName ?? "…"}</h1>
            <p className="mt-0.5 text-sm capitalize text-stone-500">
              {monthLabel}
              {data && <> · {JOB_ROLE_LABELS[data.jobRole]}</>}
              {primaryLocationName && <> · {primaryLocationName}</>}
            </p>
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
            <Link to="/hr/assiduidade?tab=fechamento" className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-600 hover:bg-stone-50">
              ← Voltar ao fecho mensal
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
            {/* Resumo do mês — 1 card subdividido, nunca 9 cards separados */}
            <div className="rounded-xl border border-stone-200 bg-white p-4">
              <div className="grid grid-cols-3 gap-4 sm:max-w-md">
                <div>
                  <p className="text-xs font-medium text-stone-400">Planeado</p>
                  <p className="text-lg font-bold text-stone-800">{formatMinutesAsWholeHours(data.kpis.plannedMinutes)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-stone-400">Realizado</p>
                  <p className="text-lg font-bold text-stone-800">{formatMinutesAsWholeHours(data.kpis.actualMinutesConfirmed)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-stone-400">Saldo</p>
                  {data.kpis.pendingCount === 0 ? (
                    <p className={`text-lg font-bold ${data.kpis.balanceConfirmed < 0 ? "text-red-600" : "text-emerald-600"}`}>{formatMinutes(data.kpis.balanceConfirmed)}</p>
                  ) : (
                    <p className="text-lg font-bold text-stone-400">Por calcular</p>
                  )}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 border-t border-stone-100 pt-3 text-sm text-stone-600">
                <p>
                  <span className="font-medium text-stone-800">
                    {data.kpis.plannedShiftsCount - data.kpis.pendingCount}/{data.kpis.plannedShiftsCount}
                  </span>{" "}
                  turnos conferidos
                </p>
                <p>
                  {data.kpis.absenceDaysCount} ausências · {data.kpis.lateDaysCount} atrasos
                  {data.kpis.lateMinutesTotal > 0 && <> ({formatMinutes(data.kpis.lateMinutesTotal)})</>}
                </p>
              </div>
            </div>

            {isClosed ? (
              <div className="rounded-xl border border-stone-200 bg-white p-6 text-center">
                <p className="text-base font-semibold text-stone-800">✓ {monthLabel} fechado</p>
                <p className="mt-1 text-sm text-stone-500">
                  Fechado por {closure?.closedBy} em {closure?.closedAt ? new Date(closure.closedAt).toLocaleDateString("pt-PT") : "—"}
                </p>
              </div>
            ) : pendingRows.length === 0 ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
                <p className="text-base font-semibold text-emerald-800">✓ Conferência concluída</p>
                <p className="mt-1 text-sm text-emerald-700">Este colaborador está pronto para fechar {monthLabel}.</p>
                <Link to="/hr/assiduidade?tab=fechamento" className="mt-3 inline-block rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800">
                  Voltar ao fecho mensal
                </Link>
              </div>
            ) : (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-red-800">Mês não pode ser fechado</p>
                    <p className="text-sm text-red-700">Existem {pendingRows.length} pendências para resolver.</p>
                  </div>
                  <Link to={conferenceSearchHref} className="text-sm font-medium text-red-700 hover:underline">
                    Ver conferência completa →
                  </Link>
                </div>
              </div>
            )}

            {!isClosed && pendingRows.length > 0 && (
              <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-stone-100 text-left text-xs font-medium uppercase text-stone-400">
                      <th className="px-4 py-2.5">Data</th>
                      <th className="px-4 py-2.5">Turno planeado</th>
                      <th className="px-4 py-2.5">Problema</th>
                      <th className="px-4 py-2.5">Tipo</th>
                      <th className="px-4 py-2.5">Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visiblePending.map((row) => {
                      const key = issueKey(row);
                      return (
                        <tr key={key} className="border-b border-stone-50 last:border-0 hover:bg-stone-50/60">
                          <td className="whitespace-nowrap px-4 py-2.5 text-stone-600">
                            {new Date(`${row.workDate}T00:00:00`).toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric" })}
                          </td>
                          <td className="whitespace-nowrap px-4 py-2.5 text-stone-600">{plannedLabel(row)}</td>
                          <td className="px-4 py-2.5 font-medium text-red-600">{row.occurrenceLabel}</td>
                          <td className="whitespace-nowrap px-4 py-2.5">
                            <span className="inline-block rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-medium text-stone-600">{OCCURRENCE_TYPE_LABEL[row.occurrenceKind]}</span>
                          </td>
                          <td className="whitespace-nowrap px-4 py-2.5">
                            <button
                              type="button"
                              onClick={() => setSelectedKey(key)}
                              className="rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50"
                            >
                              Resolver
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {pendingRows.length > PENDING_PAGE_SIZE && !showAllPending && (
                  <button
                    type="button"
                    onClick={() => setShowAllPending(true)}
                    className="w-full border-t border-stone-100 py-2.5 text-center text-sm font-medium text-stone-500 hover:bg-stone-50"
                  >
                    Ver mais {pendingRows.length - PENDING_PAGE_SIZE} pendências ↓
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {detail && <AttendanceIssueResolutionModal issue={detail} onClose={() => setSelectedKey(null)} onCorrected={() => setSelectedKey(null)} />}
    </div>
  );
}
