import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useHrModule } from "../../hr.module.tsx";
import { formatMinutes, formatMinutesAsWholeHours } from "../../../../lib/format-minutes.ts";
import type { AttendanceEmployeeStatus } from "../../domain/entities/attendance-summary.ts";

const STATUS_LABELS: Record<AttendanceEmployeeStatus, string> = {
  pronto_para_fecho: "Pronto para fecho",
  pendencias: "Pendências",
  requer_atencao: "Requer atenção",
};

const STATUS_STYLES: Record<AttendanceEmployeeStatus, string> = {
  pronto_para_fecho: "bg-emerald-50 text-emerald-700",
  pendencias: "bg-amber-50 text-amber-700",
  requer_atencao: "bg-red-50 text-red-700",
};

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

/**
 * "Por colaborador" (substitui "Resumo mensal") — task "Assiduidade —
 * Conferência, Por Colaborador e Horas & Saldos", secção 17: resumo
 * mensal comparativo da equipa + acesso ao extrato individual (nome
 * clicável → `/hr/assiduidade/colaborador/:id`). Filtros de função/
 * vínculo do mockup ficam de fora nesta ronda — ver README, Known gaps.
 */
export function AttendancePeopleSummaryView({ year, month, locationId }: { year: number; month: number; locationId?: string }) {
  const { api } = useHrModule();
  const [search, setSearch] = useState("");

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["hr-attendance-summary", year, month, locationId],
    queryFn: () => api.getMonthlyAttendanceSummary(year, month, locationId),
  });

  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString("pt-PT", { month: "long", year: "numeric" });

  const filteredRows = useMemo(() => {
    if (!data) return [];
    const term = search.trim().toLowerCase();
    return term ? data.rows.filter((r) => r.employeeName.toLowerCase().includes(term)) : data.rows;
  }, [data, search]);

  function handleExport() {
    if (!data) return;
    const rows: string[][] = [
      ["Colaborador", "Turnos", "Pendentes", "Dias em atraso", "Horas em atraso", "Ausências (dias)", "Planeadas", "Realizadas", "Saldo", "Estado"],
      ...filteredRows.map((r) => [
        r.employeeName,
        String(r.plannedShiftsCount),
        String(r.pendingCount),
        String(r.lateDaysCount),
        formatMinutes(r.lateMinutesTotal),
        String(r.absenceDaysCount),
        formatMinutesAsWholeHours(r.plannedMinutes),
        formatMinutesAsWholeHours(r.actualMinutes),
        formatMinutes(r.balanceMinutes),
        STATUS_LABELS[r.status],
      ]),
    ];
    downloadCsv(`por-colaborador-assiduidade-${year}-${String(month).padStart(2, "0")}.csv`, rows);
  }

  if (isLoading) {
    return <div className="rounded-xl border border-dashed border-stone-200 bg-white p-8 text-center text-sm text-stone-400">A carregar…</div>;
  }

  if (isError || !data) {
    return (
      <div className="rounded-xl border border-dashed border-stone-200 bg-white p-8 text-center text-sm text-stone-400" title={error instanceof Error ? error.message : undefined}>
        Indisponível — o backend ainda não expõe este agregado.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="grid grid-cols-5 gap-3">
          <div className="rounded-xl border border-[#F5C992]/40 bg-white px-4 py-3 shadow-sm">
            <p className="text-xs font-medium text-stone-500">Colaboradores</p>
            <p className="mt-0.5 text-lg font-bold text-stone-800">{data.kpis.employeeCount}</p>
          </div>
          <div className="rounded-xl border border-[#F5C992]/40 bg-white px-4 py-3 shadow-sm">
            <p className="text-xs font-medium text-stone-500">Turnos planeados</p>
            <p className="mt-0.5 text-lg font-bold text-stone-800">{data.kpis.plannedShiftsCount}</p>
          </div>
          <div className="rounded-xl border border-[#F5C992]/40 bg-white px-4 py-3 shadow-sm">
            <p className="text-xs font-medium text-stone-500">Turnos realizados</p>
            <p className="mt-0.5 text-lg font-bold text-emerald-600">{data.kpis.actualShiftsCount}</p>
          </div>
          <div className="rounded-xl border border-[#F5C992]/40 bg-white px-4 py-3 shadow-sm">
            <p className="text-xs font-medium text-stone-500">Dias em atraso</p>
            <p className="mt-0.5 text-lg font-bold text-amber-600">{data.kpis.lateDaysCount}</p>
          </div>
          <div className="rounded-xl border border-[#F5C992]/40 bg-white px-4 py-3 shadow-sm">
            <p className="text-xs font-medium text-stone-500">Horas em atraso</p>
            <p className="mt-0.5 text-lg font-bold text-red-600">{formatMinutes(data.kpis.lateMinutesTotal)}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleExport}
          className="shrink-0 rounded-lg border border-stone-200 px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-50"
        >
          ⬇ Exportar
        </button>
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Pesquisar colaborador..."
        className="w-64 rounded-md border border-stone-300 bg-white py-1.5 px-3 text-sm text-stone-700 outline-none focus:border-[#ED5C32]"
      />

      <div className="overflow-x-auto rounded-xl border border-[#F5C992]/40 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-100 text-left text-xs font-medium uppercase text-stone-400">
              <th className="px-4 py-2.5">Colaborador</th>
              <th className="px-4 py-2.5">Turnos</th>
              <th className="px-4 py-2.5">Pendentes</th>
              <th className="px-4 py-2.5">Dias em atraso</th>
              <th className="px-4 py-2.5">H. atraso</th>
              <th className="px-4 py-2.5">Ausências</th>
              <th className="px-4 py-2.5">H. planeadas</th>
              <th className="px-4 py-2.5">H. realizadas</th>
              <th className="px-4 py-2.5">Saldo</th>
              <th className="px-4 py-2.5">Estado</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-stone-400">
                  Sem dados para {monthLabel}.
                </td>
              </tr>
            ) : (
              filteredRows.map((r) => (
                <tr key={r.employeeId} className="border-b border-stone-50 last:border-0 hover:bg-stone-50/60">
                  <td className="px-4 py-2.5 font-medium">
                    <Link to={`/hr/assiduidade/colaborador/${r.employeeId}?year=${year}&month=${month}`} className="text-stone-800 hover:text-[#ED5C32] hover:underline">
                      {r.employeeName}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-stone-600">{r.plannedShiftsCount}</td>
                  <td className={`px-4 py-2.5 font-medium ${r.pendingCount > 0 ? "text-red-600" : "text-stone-600"}`}>{r.pendingCount}</td>
                  <td className="px-4 py-2.5 text-stone-600">{r.lateDaysCount}</td>
                  <td className="px-4 py-2.5 text-stone-600">{formatMinutes(r.lateMinutesTotal)}</td>
                  <td className="px-4 py-2.5 text-stone-600">{r.absenceDaysCount}</td>
                  <td className="px-4 py-2.5 text-stone-600">{formatMinutesAsWholeHours(r.plannedMinutes)}</td>
                  <td className="px-4 py-2.5 text-stone-600">{formatMinutesAsWholeHours(r.actualMinutes)}</td>
                  <td className={`px-4 py-2.5 font-medium ${r.balanceMinutes < 0 ? "text-red-600" : "text-emerald-600"}`}>{formatMinutes(r.balanceMinutes)}</td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[r.status]}`}>
                      {STATUS_LABELS[r.status]}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
