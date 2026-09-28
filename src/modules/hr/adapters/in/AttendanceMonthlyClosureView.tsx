import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useHrModule } from "../../hr.module.tsx";
import { formatMinutes, formatMinutesAsWholeHours } from "../../../../lib/format-minutes.ts";
import type { MonthlyAttendanceSummaryRow } from "../../domain/entities/attendance-summary.ts";

type ReadinessFilter = "all" | "ready" | "pending";

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows.map((r) => r.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(";")).join("\r\n");
  const bom = String.fromCharCode(0xfeff);
  const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Pronto = sem nenhuma pendência (task "Simplificar Assiduidade", secção 16) — colapsa os 3 estados internos do backend (`pronto_para_fecho|pendencias|requer_atencao`, usados só em relatórios/exportação) para os 2 que o ecrã pede. Nunca depende de saldo negativo (secção 13/16). */
function isReady(row: MonthlyAttendanceSummaryRow): boolean {
  return row.pendingCount === 0;
}

/**
 * "Fecho mensal" (task "Simplificar Assiduidade em Conferência + Fecho
 * Mensal") — funde o antigo "Por colaborador" (tabela por colaborador) com
 * a antiga `MonthlyClosureBar` (estado do período, fechar/reabrir) numa
 * única aba. Responde "como está cada colaborador e já posso encerrar o
 * mês?" (secção 11) — nunca um fecho individual por colaborador (secção
 * 17): só existe um "Fechar mês", a nível do período inteiro.
 */
export function AttendanceMonthlyClosureView({
  year,
  month,
  locationId,
  onGoToConference,
}: {
  year: number;
  month: number;
  locationId?: string;
  onGoToConference: () => void;
}) {
  const { api } = useHrModule();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [readinessFilter, setReadinessFilter] = useState<ReadinessFilter>("all");
  const [reopening, setReopening] = useState(false);
  const [reopenReason, setReopenReason] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: summary, isLoading: summaryLoading, isError: summaryError, error: summaryErrorObj } = useQuery({
    queryKey: ["hr-attendance-summary", year, month, locationId],
    queryFn: () => api.getMonthlyAttendanceSummary(year, month, locationId),
  });

  const { data: closure, isLoading: closureLoading, isError: closureError } = useQuery({
    queryKey: ["hr-attendance-closure", year, month],
    queryFn: () => api.getMonthlyClosureStatus(year, month),
  });

  function invalidate() {
    void qc.invalidateQueries({ queryKey: ["hr-attendance-closure", year, month] });
    void qc.invalidateQueries({ queryKey: ["hr-attendance-summary", year, month] });
    void qc.invalidateQueries({ queryKey: ["hr-attendance-issues"] });
  }

  const closeMutation = useMutation({
    mutationFn: () => api.closeMonthlyPeriod(year, month),
    onSuccess: invalidate,
    onError: (e: unknown) => setActionError(e instanceof Error ? e.message : "Não foi possível fechar o período"),
  });

  const reopenMutation = useMutation({
    mutationFn: () => api.reopenMonthlyPeriod(year, month, reopenReason),
    onSuccess: () => {
      setReopening(false);
      setReopenReason("");
      invalidate();
    },
    onError: (e: unknown) => setActionError(e instanceof Error ? e.message : "Não foi possível reabrir o período"),
  });

  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString("pt-PT", { month: "long", year: "numeric" });

  const filteredRows = useMemo(() => {
    if (!summary) return [];
    const term = search.trim().toLowerCase();
    return summary.rows.filter((r) => {
      if (term && !r.employeeName.toLowerCase().includes(term)) return false;
      if (readinessFilter === "ready" && !isReady(r)) return false;
      if (readinessFilter === "pending" && isReady(r)) return false;
      return true;
    });
  }, [summary, search, readinessFilter]);

  const readyCount = summary ? summary.rows.filter(isReady).length : 0;
  const pendingEmployeeCount = summary ? summary.rows.length - readyCount : 0;
  const periodReady = closure ? closure.blockerCount === 0 : false;

  function handleClose() {
    if (!window.confirm(`Fechar ${monthLabel}? Depois de fechado, os dados consolidados ficam protegidos e só podem ser alterados reabrindo o período.`)) {
      return;
    }
    setActionError(null);
    closeMutation.mutate();
  }

  function handleExport() {
    if (!summary) return;
    const rows: string[][] = [
      ["Colaborador", "Turnos", "Pendências", "Ausências (dias)", "Dias atraso", "H. atraso", "H. planeadas", "H. realizadas", "Saldo", "Estado"],
      ...filteredRows.map((r) => [
        r.employeeName,
        String(r.plannedShiftsCount),
        String(r.pendingCount),
        String(r.absenceDaysCount),
        String(r.lateDaysCount),
        formatMinutes(r.lateMinutesTotal),
        formatMinutesAsWholeHours(r.plannedMinutes),
        formatMinutesAsWholeHours(r.actualMinutes),
        isReady(r) ? formatMinutes(r.balanceMinutes) : "aguarda conferência",
        isReady(r) ? "Pronto" : "Com pendências",
      ]),
    ];
    downloadCsv(`fecho-mensal-assiduidade-${year}-${String(month).padStart(2, "0")}.csv`, rows);
  }

  if (summaryLoading || closureLoading) {
    return <div className="rounded-xl border border-dashed border-stone-200 bg-white p-8 text-center text-sm text-stone-400">A carregar…</div>;
  }

  if (summaryError || closureError || !summary || !closure) {
    return (
      <div className="rounded-xl border border-dashed border-stone-200 bg-white p-8 text-center text-sm text-stone-400" title={summaryErrorObj instanceof Error ? summaryErrorObj.message : undefined}>
        Indisponível — não foi possível carregar o fecho mensal.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Cabeçalho compacto do período — secção 11: sem grid de cards */}
      <div className="flex flex-col gap-3 rounded-xl border border-[#F5C992]/40 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold capitalize text-stone-800">Fecho mensal — {monthLabel}</p>
          {closure.status === "closed" ? (
            <p className="text-xs text-emerald-600">
              Fechado por {closure.closedBy} em{" "}
              {closure.closedAt
                ? new Date(closure.closedAt).toLocaleDateString("pt-PT") + " às " + new Date(closure.closedAt).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })
                : "—"}
            </p>
          ) : (
            <p className="text-xs text-stone-500">
              {summary.kpis.employeeCount} colaboradores · {readyCount} pronto{readyCount === 1 ? "" : "s"} ·{" "}
              {pendingEmployeeCount > 0 ? (
                <button type="button" onClick={onGoToConference} className="font-medium text-red-600 hover:underline">
                  {pendingEmployeeCount} com pendências
                </button>
              ) : (
                "0 com pendências"
              )}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              closure.status === "closed" ? "bg-emerald-50 text-emerald-700" : periodReady ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
            }`}
          >
            {closure.status === "closed" ? "Fechado" : periodReady ? "Pronto para fecho" : "Com pendências"}
          </span>

          {closure.status === "open" ? (
            <button
              type="button"
              disabled={!periodReady || closeMutation.isPending}
              onClick={handleClose}
              className="rounded-lg bg-gradient-to-r from-[#ED5C32] to-[#EF8935] px-4 py-2 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {closeMutation.isPending ? "A fechar…" : "Fechar mês"}
            </button>
          ) : reopening ? (
            <div className="flex items-center gap-2">
              <input
                value={reopenReason}
                onChange={(e) => setReopenReason(e.target.value)}
                placeholder="Motivo da reabertura…"
                className="rounded-md border border-stone-300 bg-white py-1.5 px-3 text-sm text-stone-700 outline-none focus:border-[#ED5C32]"
              />
              <button
                type="button"
                disabled={!reopenReason.trim() || reopenMutation.isPending}
                onClick={() => reopenMutation.mutate()}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-40"
              >
                Confirmar
              </button>
              <button type="button" onClick={() => setReopening(false)} className="text-xs text-stone-400 hover:text-stone-600">
                Cancelar
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setReopening(true)}
              className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
            >
              Reabrir período
            </button>
          )}
        </div>
      </div>

      {actionError && <p className="text-xs text-red-600">{actionError}</p>}

      {/* Filtros — secção 12: sem cards de resumo extra */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex rounded-lg border border-stone-200 bg-white p-0.5 text-sm">
          {(
            [
              { key: "all", label: `Todos (${summary.rows.length})` },
              { key: "ready", label: `Prontos (${readyCount})` },
              { key: "pending", label: `Com pendências (${pendingEmployeeCount})` },
            ] as { key: ReadinessFilter; label: string }[]
          ).map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setReadinessFilter(key)}
              className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
                readinessFilter === key ? "bg-stone-800 text-white" : "text-stone-500 hover:bg-stone-100"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar colaborador..."
            className="w-56 rounded-md border border-stone-300 bg-white py-1.5 px-3 text-sm text-stone-700 outline-none focus:border-[#ED5C32]"
          />
          <button
            type="button"
            onClick={handleExport}
            className="shrink-0 rounded-lg border border-stone-200 px-3 py-2 text-sm font-medium text-stone-600 hover:bg-stone-50"
          >
            ⬇ Exportar
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[#F5C992]/40 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-100 text-left text-xs font-medium uppercase text-stone-400">
              <th className="px-4 py-2.5">Colaborador</th>
              <th className="px-4 py-2.5">Turnos</th>
              <th className="px-4 py-2.5">Pendências</th>
              <th className="px-4 py-2.5">Ausências</th>
              <th className="px-4 py-2.5">Dias atraso</th>
              <th className="px-4 py-2.5">H. atraso</th>
              <th className="px-4 py-2.5">H. planeadas</th>
              <th className="px-4 py-2.5">H. realizadas</th>
              <th className="px-4 py-2.5">Saldo</th>
              <th className="px-4 py-2.5">Estado</th>
              <th className="px-4 py-2.5">Ação</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-4 py-8 text-center text-stone-400">
                  Sem colaboradores para este filtro.
                </td>
              </tr>
            ) : (
              filteredRows.map((r) => {
                const ready = isReady(r);
                return (
                  <tr key={r.employeeId} className="border-b border-stone-50 last:border-0 hover:bg-stone-50/60">
                    <td className="px-4 py-2.5 font-medium text-stone-800">{r.employeeName}</td>
                    <td className="px-4 py-2.5 text-stone-600">{r.plannedShiftsCount}</td>
                    <td className={`px-4 py-2.5 font-medium ${r.pendingCount > 0 ? "text-red-600" : "text-stone-600"}`}>{r.pendingCount}</td>
                    <td className="px-4 py-2.5 text-stone-600">{r.absenceDaysCount}</td>
                    <td className="px-4 py-2.5 text-stone-600">{r.lateDaysCount}</td>
                    <td className="px-4 py-2.5 text-stone-600">{formatMinutes(r.lateMinutesTotal)}</td>
                    <td className="px-4 py-2.5 text-stone-600">{formatMinutesAsWholeHours(r.plannedMinutes)}</td>
                    <td className="px-4 py-2.5 text-stone-600">{formatMinutesAsWholeHours(r.actualMinutes)}</td>
                    <td className="px-4 py-2.5">
                      {ready ? (
                        <span className={r.balanceMinutes < 0 ? "font-medium text-red-600" : "font-medium text-emerald-600"}>
                          {formatMinutes(r.balanceMinutes)}
                        </span>
                      ) : (
                        <span className="text-stone-400" title="Saldo só é definitivo depois de resolvidas todas as pendências">
                          — <span className="text-xs">aguarda conferência</span>
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${ready ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                        {ready ? "Pronto" : "Com pendências"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <Link
                        to={`/hr/assiduidade/colaborador/${r.employeeId}?year=${year}&month=${month}`}
                        className="rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50"
                      >
                        Ver detalhe
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
