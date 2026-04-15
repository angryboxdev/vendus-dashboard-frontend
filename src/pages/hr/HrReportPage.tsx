import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { fetchEmployees, fetchShifts } from "./hrApi";
import { hrQueryKeys } from "./hrQueryKeys";
import { parseTimeToMinutes, getCivilMonthRangeIso, getCurrentYearMonthLisbon } from "./dates";
import { SkeletonBlock } from "./components/SkeletonBlock";
import type { HrEmployee, HrWorkShift } from "./hr.types";

// ---------- tipos ----------

type EmployeeStats = {
  employee: HrEmployee;
  totalShifts: number;
  worked: number;
  absentJ: number;
  absentNJ: number;
  cancelled: number;
  pending: number;
  attendanceRate: number | null;
  plannedMins: number;
  actualMins: number;
  balanceMins: number;
  lateCount: number;
  totalLateMinutes: number;
  leftEarlyCount: number;
};

// ---------- helpers ----------

function shiftDuration(start: string, end: string): number {
  const s = parseTimeToMinutes(start);
  const e = parseTimeToMinutes(end);
  return s !== null && e !== null ? Math.max(0, e - s) : 0;
}

function computeStats(employee: HrEmployee, shifts: HrWorkShift[]): EmployeeStats {
  const mine = shifts.filter((s) => s.employeeId === employee.id);

  let worked = 0, absentJ = 0, absentNJ = 0, cancelled = 0, pending = 0;
  let lateCount = 0, totalLateMinutes = 0, leftEarlyCount = 0;
  let plannedMins = 0, actualMins = 0, balanceMins = 0;

  for (const s of mine) {
    const att = s.attendance;

    if (!att) {
      pending++;
    } else {
      switch (att.status) {
        case "worked_as_planned": worked++; break;
        case "late":              worked++; lateCount++; totalLateMinutes += att.lateMinutes ?? 0; break;
        case "left_early":        worked++; leftEarlyCount++; break;
        case "absent_justified":  absentJ++; break;
        case "absent_unjustified":absentNJ++; break;
        case "cancelled":         cancelled++; break;
      }
    }

    // Horas planeadas (excl. cancelados)
    if (!att || att.status !== "cancelled") {
      plannedMins += shiftDuration(s.startTime, s.endTime);
    }

    // Horas reais + saldo (só onde há entrada e saída registadas)
    if (att?.actualStartTime && att?.actualEndTime) {
      const actual = shiftDuration(att.actualStartTime, att.actualEndTime);
      const planned = shiftDuration(s.startTime, s.endTime);
      actualMins += actual;
      balanceMins += actual - planned;
    }
  }

  const rateDenom = worked + absentJ + absentNJ;
  const attendanceRate = rateDenom > 0 ? Math.round((worked / rateDenom) * 100) : null;

  return {
    employee, totalShifts: mine.length,
    worked, absentJ, absentNJ, cancelled, pending,
    attendanceRate, plannedMins, actualMins, balanceMins,
    lateCount, totalLateMinutes, leftEarlyCount,
  };
}

function fmtMins(mins: number, showSign = false): string {
  if (mins === 0) return "0h";
  const abs = Math.abs(mins);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  const sign = showSign ? (mins < 0 ? "−" : "+") : (mins < 0 ? "−" : "");
  return `${sign}${h}h${m > 0 ? `${String(m).padStart(2, "0")}m` : ""}`;
}

function AttendanceBadge({ rate }: { rate: number | null }) {
  if (rate === null) return <span className="text-slate-400 text-xs">—</span>;
  const color =
    rate >= 95 ? "text-emerald-700 bg-emerald-50 ring-emerald-200"
    : rate >= 80 ? "text-amber-700 bg-amber-50 ring-amber-200"
    : "text-red-700 bg-red-50 ring-red-200";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${color}`}>
      {rate}%
    </span>
  );
}

function BalanceCell({ mins }: { mins: number }) {
  if (mins === 0) return <span className="text-slate-500 text-xs">0h</span>;
  const cls = mins > 0 ? "text-emerald-700 font-medium" : "text-red-600 font-medium";
  return <span className={`text-xs ${cls}`}>{fmtMins(mins, true)}</span>;
}

function SummaryCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
      {sub ? <p className="mt-0.5 text-xs text-slate-400">{sub}</p> : null}
    </div>
  );
}

// ---------- componente principal ----------

export function HrReportPage() {
  const initial = getCurrentYearMonthLisbon();
  const [year, setYear] = useState(initial.year);
  const [month, setMonth] = useState(initial.month);

  const range = useMemo(() => getCivilMonthRangeIso(year, month), [year, month]);

  const { data: employees, isPending: empLoading } = useQuery({
    queryKey: hrQueryKeys.employees({ status: "active" }),
    queryFn: () => fetchEmployees({ status: "active" }),
  });

  const shiftsParams = useMemo(
    () => ({ from: range.from, to: range.to }),
    [range.from, range.to],
  );

  const { data: shifts, isPending: shiftsLoading } = useQuery({
    queryKey: hrQueryKeys.shifts(shiftsParams),
    queryFn: () => fetchShifts(shiftsParams),
  });

  const stats = useMemo<EmployeeStats[]>(() => {
    if (!employees || !shifts) return [];
    return employees
      .map((e) => computeStats(e, shifts))
      .filter((s) => s.totalShifts > 0)
      .sort((a, b) => {
        // Sem dados vai para o fundo; piores taxas primeiro
        if (a.attendanceRate === null) return 1;
        if (b.attendanceRate === null) return -1;
        return a.attendanceRate - b.attendanceRate;
      });
  }, [employees, shifts]);

  // Totais para os cards de resumo
  const summary = useMemo(() => {
    const withRate = stats.filter((s) => s.attendanceRate !== null);
    const avgRate = withRate.length
      ? Math.round(withRate.reduce((acc, s) => acc + (s.attendanceRate ?? 0), 0) / withRate.length)
      : null;
    const totalPlanned = stats.reduce((acc, s) => acc + s.plannedMins, 0);
    const totalActual = stats.reduce((acc, s) => acc + s.actualMins, 0);
    const totalBalance = stats.reduce((acc, s) => acc + s.balanceMins, 0);
    const totalAbsentNJ = stats.reduce((acc, s) => acc + s.absentNJ, 0);
    return { avgRate, totalPlanned, totalActual, totalBalance, totalAbsentNJ };
  }, [stats]);

  const loading = empLoading || shiftsLoading;
  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString("pt-PT", {
    month: "long", year: "numeric",
  });

  function prevMonth() {
    if (month <= 1) { setYear((y) => y - 1); setMonth(12); }
    else setMonth((m) => m - 1);
  }
  function nextMonth() {
    if (month >= 12) { setYear((y) => y + 1); setMonth(1); }
    else setMonth((m) => m + 1);
  }

  return (
    <div className="mx-auto max-w-6xl p-6">
      {/* cabeçalho */}
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 pb-4">
        <h2 className="flex-1 text-xl font-semibold text-slate-900 capitalize">
          Assiduidade — {monthLabel}
        </h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={prevMonth}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
          >
            ←
          </button>
          <span className="min-w-[6rem] text-center text-sm font-medium text-slate-700 capitalize">
            {monthLabel}
          </span>
          <button
            type="button"
            onClick={nextMonth}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
          >
            →
          </button>
        </div>
      </div>

      {/* cards de resumo */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard
          label="Funcionários com turnos"
          value={String(stats.length)}
        />
        <SummaryCard
          label="Assiduidade média"
          value={summary.avgRate !== null ? `${summary.avgRate}%` : "—"}
          sub="trabalhado / (trab.+faltas)"
        />
        <SummaryCard
          label="Horas realizadas / planeadas"
          value={
            summary.totalActual > 0
              ? `${fmtMins(summary.totalActual)} / ${fmtMins(summary.totalPlanned)}`
              : `— / ${fmtMins(summary.totalPlanned)}`
          }
          sub={
            summary.totalBalance !== 0
              ? `saldo: ${fmtMins(summary.totalBalance, true)}`
              : undefined
          }
        />
        <SummaryCard
          label="Faltas não justificadas"
          value={String(summary.totalAbsentNJ)}
          sub={summary.totalAbsentNJ > 0 ? "requer atenção" : "sem ocorrências"}
        />
      </div>

      {/* tabela */}
      <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold text-slate-600">
            <tr>
              <th className="px-4 py-3">Funcionário</th>
              <th className="px-3 py-3 text-center">Turnos</th>
              <th className="px-3 py-3 text-center">Assiduidade</th>
              <th className="px-3 py-3 text-center">Faltas J</th>
              <th className="px-3 py-3 text-center">Faltas NJ</th>
              <th className="px-3 py-3 text-center">Atrasos</th>
              <th className="px-3 py-3 text-center">Horas plan.</th>
              <th className="px-3 py-3 text-center">Horas real.</th>
              <th className="px-3 py-3 text-center">Saldo</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} className="px-4 py-6">
                  <SkeletonBlock className="h-24 w-full" />
                </td>
              </tr>
            ) : stats.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                  Sem turnos registados neste período.
                </td>
              </tr>
            ) : (
              stats.map((s) => (
                <tr key={s.employee.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link
                      to={`/hr/employees/${s.employee.id}`}
                      className="font-medium text-slate-900 hover:text-indigo-700 hover:underline"
                    >
                      {s.employee.fullName}
                    </Link>
                    {s.pending > 0 && (
                      <span className="ml-2 inline-flex rounded-full bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800">
                        {s.pending} pend.
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-center text-xs text-slate-700">
                    {s.worked + s.absentJ + s.absentNJ + s.pending}
                    {s.cancelled > 0 && (
                      <span className="ml-1 text-slate-400">({s.cancelled} canc.)</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-center">
                    <AttendanceBadge rate={s.attendanceRate} />
                  </td>
                  <td className="px-3 py-3 text-center text-xs text-slate-600">
                    {s.absentJ > 0 ? s.absentJ : <span className="text-slate-300">0</span>}
                  </td>
                  <td className="px-3 py-3 text-center text-xs">
                    {s.absentNJ > 0 ? (
                      <span className="font-semibold text-red-600">{s.absentNJ}</span>
                    ) : (
                      <span className="text-slate-300">0</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-center text-xs text-slate-600">
                    {s.lateCount > 0 ? (
                      <span title={`${s.totalLateMinutes} min total`}>
                        {s.lateCount}×
                        {s.totalLateMinutes > 0 && (
                          <span className="ml-1 text-slate-400">
                            ({s.totalLateMinutes}min)
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-center text-xs text-slate-600">
                    {fmtMins(s.plannedMins)}
                  </td>
                  <td className="px-3 py-3 text-center text-xs text-slate-600">
                    {s.actualMins > 0 ? fmtMins(s.actualMins) : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-3 py-3 text-center">
                    {s.actualMins > 0
                      ? <BalanceCell mins={s.balanceMins} />
                      : <span className="text-slate-400 text-xs">—</span>}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {stats.length > 0 && (
        <p className="mt-3 text-xs text-slate-400">
          Assiduidade = presenças ÷ (presenças + faltas). Turnos pendentes e cancelados excluídos do cálculo.
          Horas e saldo calculados apenas para turnos com entrada e saída registadas.
        </p>
      )}
    </div>
  );
}
