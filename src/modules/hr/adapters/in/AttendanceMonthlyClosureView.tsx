import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useHrModule } from "../../hr.module.tsx";
import { useLocations } from "../../../locations/adapters/in/use-locations.ts";
import { formatMinutes, formatMinutesAsWholeHours } from "../../../../lib/format-minutes.ts";
import { JOB_ROLE_LABELS } from "../../domain/entities/employee.ts";
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

/** Pronto = sem nenhuma pendência — colapsa os 3 estados internos do backend (`pronto_para_fecho|pendencias|requer_atencao`) para os 2 que o ecrã pede. Nunca depende de saldo negativo. */
function isReady(row: MonthlyAttendanceSummaryRow): boolean {
  return row.pendingCount === 0;
}

/** Redesign do Fecho Mensal, secção 9 — agrupa ausências/atrasos numa única célula "Ocorrências", em vez de colunas separadas. */
function occurrencesText(row: MonthlyAttendanceSummaryRow): string {
  const parts: string[] = [];
  if (row.absenceDaysCount > 0) parts.push(`${row.absenceDaysCount} ausência${row.absenceDaysCount === 1 ? "" : "s"}`);
  if (row.lateDaysCount > 0) {
    const suffix = row.lateMinutesTotal > 0 ? ` · ${formatMinutes(row.lateMinutesTotal)}` : "";
    parts.push(`${row.lateDaysCount} atraso${row.lateDaysCount === 1 ? "" : "s"}${suffix}`);
  }
  return parts.length > 0 ? parts.join(" · ") : "—";
}

/**
 * "Fecho mensal" — funde o "Por colaborador" (tabela por colaborador) com
 * o estado do período (fechar/reabrir) numa única aba. Redesign
 * ("Redesign completo do Fecho Mensal") reduziu de 11 para 8 colunas e
 * trocou o grid de KPIs por um resumo compacto de 1 linha — ver
 * README para a correspondência exata com os campos já existentes
 * (nenhum endpoint novo: o ratio "Conferência X/Y" e "Ocorrências"
 * são só reapresentação de `plannedShiftsCount`/`pendingCount`/
 * `absenceDaysCount`/`lateDaysCount` que já existiam). Nunca um fecho
 * individual por colaborador: só existe um "Fechar mês", a nível do
 * período inteiro.
 */
export function AttendanceMonthlyClosureView({
  year,
  month,
  locationId,
  onLocationChange,
}: {
  year: number;
  month: number;
  locationId: string;
  onLocationChange: (locationId: string) => void;
}) {
  const { api } = useHrModule();
  const { locations } = useLocations();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [readinessFilter, setReadinessFilter] = useState<ReadinessFilter>("all");
  const [reopening, setReopening] = useState(false);
  const [reopenReason, setReopenReason] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: summary, isLoading: summaryLoading, isError: summaryError, error: summaryErrorObj } = useQuery({
    queryKey: ["hr-attendance-summary", year, month, locationId],
    queryFn: () => api.getMonthlyAttendanceSummary(year, month, locationId || undefined),
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
  const isClosed = closure?.status === "closed";

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
  const employeeCount = summary?.rows.length ?? 0;
  const pendingEmployeeCount = employeeCount - readyCount;
  const readyPct = employeeCount > 0 ? Math.round((readyCount / employeeCount) * 100) : 0;
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
      ["Colaborador", "Cargo", "Conferência (conferidos/planeados)", "Planeado", "Realizado", "Ocorrências", "Saldo", "Estado"],
      ...filteredRows.map((r) => [
        r.employeeName,
        JOB_ROLE_LABELS[r.jobRole],
        `${r.plannedShiftsCount - r.pendingCount}/${r.plannedShiftsCount}`,
        formatMinutesAsWholeHours(r.plannedMinutes),
        formatMinutesAsWholeHours(r.actualMinutes),
        occurrencesText(r),
        isReady(r) ? formatMinutes(r.balanceMinutes) : "aguarda conferência",
        isClosed ? "Fechado" : isReady(r) ? "Pronto" : "Com pendências",
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
      {/* Resumo do período — compacto, nunca um card gigante */}
      <div className="flex flex-col gap-4 rounded-xl border border-stone-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">{monthLabel}</p>
          {isClosed ? (
            <p className="mt-1 text-sm text-emerald-700">
              Fechado por {closure.closedBy} em{" "}
              {closure.closedAt
                ? new Date(closure.closedAt).toLocaleDateString("pt-PT") + " às " + new Date(closure.closedAt).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })
                : "—"}
            </p>
          ) : (
            <>
              <p className="mt-1 text-sm text-stone-700">
                <span className="font-semibold">{employeeCount}</span> colaboradores ·{" "}
                <span className="font-semibold text-emerald-600">{readyCount}</span> prontos ·{" "}
                <span className="font-semibold text-amber-600">{pendingEmployeeCount}</span> com pendências
              </p>
              <div className="mt-2 h-1.5 max-w-sm rounded-full bg-stone-100">
                <div className="h-1.5 rounded-full bg-emerald-500 transition-all" style={{ width: `${readyPct}%` }} />
              </div>
              <p className="mt-1 text-xs text-stone-400">
                {readyCount} / {employeeCount} colaboradores prontos para fechar
              </p>
            </>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              isClosed ? "bg-stone-100 text-stone-600" : periodReady ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
            }`}
          >
            {isClosed ? "Fechado" : periodReady ? "Pronto para fecho" : "Fecho pendente"}
          </span>

          {!isClosed ? (
            <button
              type="button"
              disabled={!periodReady || closeMutation.isPending}
              onClick={handleClose}
              title={!periodReady ? "Resolva todas as pendências antes de fechar o mês." : undefined}
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
              className="rounded-lg border border-stone-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
            >
              Reabrir período
            </button>
          )}
        </div>
      </div>

      {actionError && <p className="text-xs text-red-600">{actionError}</p>}

      {/* Filtros */}
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
          {locations.length > 1 && (
            <select
              value={locationId}
              onChange={(e) => onLocationChange(e.target.value)}
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
          <button
            type="button"
            onClick={handleExport}
            className="shrink-0 rounded-lg border border-stone-200 px-3 py-2 text-sm font-medium text-stone-600 hover:bg-stone-50"
          >
            ⬇ Exportar
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-100 text-left text-xs font-medium uppercase text-stone-400">
              <th className="px-4 py-2.5">Colaborador</th>
              <th className="px-4 py-2.5">Conferência</th>
              <th className="px-4 py-2.5">Planeado</th>
              <th className="px-4 py-2.5">Realizado</th>
              <th className="px-4 py-2.5">Ocorrências</th>
              <th className="px-4 py-2.5">Saldo</th>
              <th className="px-4 py-2.5">Estado</th>
              <th className="px-4 py-2.5">Ação</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-stone-400">
                  Sem colaboradores para este filtro.
                </td>
              </tr>
            ) : (
              filteredRows.map((r) => {
                const ready = isReady(r);
                const conferred = r.plannedShiftsCount - r.pendingCount;
                const pct = r.plannedShiftsCount > 0 ? Math.round((conferred / r.plannedShiftsCount) * 100) : 100;
                return (
                  <tr key={r.employeeId} className="border-b border-stone-50 last:border-0 hover:bg-stone-50/60">
                    <td className="max-w-[220px] px-4 py-2.5">
                      <p className="truncate font-medium text-stone-800" title={r.employeeName}>
                        {r.employeeName}
                      </p>
                      <p className="text-xs text-stone-400">{JOB_ROLE_LABELS[r.jobRole]}</p>
                    </td>
                    <td className="px-4 py-2.5">
                      <p className="whitespace-nowrap text-stone-700">
                        {conferred}/{r.plannedShiftsCount} <span className="text-xs text-stone-400">{pct}%</span>
                      </p>
                      <div className="mt-1 h-1 w-20 rounded-full bg-stone-100">
                        <div className={`h-1 rounded-full ${pct === 100 ? "bg-emerald-500" : "bg-amber-500"}`} style={{ width: `${pct}%` }} />
                      </div>
                      {r.pendingCount > 0 && <p className="mt-0.5 text-xs text-red-600">{r.pendingCount} por resolver</p>}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-stone-600">{formatMinutesAsWholeHours(r.plannedMinutes)}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-stone-600">{formatMinutesAsWholeHours(r.actualMinutes)}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-stone-600">{occurrencesText(r)}</td>
                    <td className="whitespace-nowrap px-4 py-2.5">
                      {ready ? (
                        <span className={r.balanceMinutes < 0 ? "font-medium text-red-600" : "font-medium text-emerald-600"}>
                          {formatMinutes(r.balanceMinutes)}
                        </span>
                      ) : (
                        <span className="text-stone-400">
                          Por calcular
                          <span className="block text-xs">aguarda conferência</span>
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5">
                      <span
                        className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          isClosed ? "bg-stone-100 text-stone-600" : ready ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {isClosed ? "Fechado" : ready ? "Pronto" : "Com pendências"}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5">
                      <Link
                        to={`/hr/assiduidade/colaborador/${r.employeeId}?year=${year}&month=${month}`}
                        className="whitespace-nowrap rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50"
                      >
                        {isClosed ? "Ver resumo →" : "Rever fecho →"}
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
