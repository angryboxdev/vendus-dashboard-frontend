import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { formatIsoDateRangePt } from "../../lib/format";
import {
  buildMonthCalendarCells,
  getCivilMonthRangeIso,
  getCurrentYearMonthLisbon,
} from "./dates";
import { fetchEmployees, fetchShifts } from "./hrApi";
import { hrQueryKeys } from "./hrQueryKeys";
import { isShiftAttendancePending, type HrWorkShift } from "./hr.types";
import { SkeletonBlock } from "./components/SkeletonBlock";

const WEEKDAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

function shiftKey(s: HrWorkShift): string {
  return `${s.employeeId}-${s.startTime}-${s.endTime}-${s.id}`;
}

export function HrCalendarPage() {
  const initial = getCurrentYearMonthLisbon();
  const [year, setYear] = useState(initial.year);
  const [month, setMonth] = useState(initial.month);
  const [employeeId, setEmployeeId] = useState<string>("");

  const range = useMemo(
    () => getCivilMonthRangeIso(year, month),
    [year, month],
  );

  const shiftsParams = useMemo(
    () => ({
      from: range.from,
      to: range.to,
      ...(employeeId ? { employeeId } : {}),
    }),
    [range.from, range.to, employeeId],
  );

  const { data: employees } = useQuery({
    queryKey: hrQueryKeys.employees({ limit: 500, offset: 0 }),
    queryFn: () => fetchEmployees({ limit: 500, offset: 0 }),
  });

  const nameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of employees ?? []) {
      m.set(e.id, e.fullName);
    }
    return m;
  }, [employees]);

  const {
    data: shifts,
    isPending,
    error,
    refetch,
  } = useQuery({
    queryKey: hrQueryKeys.shifts(shiftsParams),
    queryFn: () => fetchShifts(shiftsParams),
  });

  const byDate = useMemo(() => {
    const map = new Map<string, HrWorkShift[]>();
    for (const s of shifts ?? []) {
      const list = map.get(s.workDate) ?? [];
      list.push(s);
      map.set(s.workDate, list);
    }
    for (const [, list] of map) {
      list.sort((a, b) => a.startTime.localeCompare(b.startTime));
    }
    return map;
  }, [shifts]);

  const weeks = useMemo(
    () => buildMonthCalendarCells(year, month),
    [year, month],
  );

  function prevMonth() {
    if (month <= 1) {
      setYear((y) => y - 1);
      setMonth(12);
    } else {
      setMonth((m) => m - 1);
    }
  }

  function nextMonth() {
    if (month >= 12) {
      setYear((y) => y + 1);
      setMonth(1);
    } else {
      setMonth((m) => m + 1);
    }
  }

  const title = `${String(month).padStart(2, "0")} / ${year}`;

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-lg font-medium text-slate-800">
            Calendário de turnos
          </h2>
          <p className="text-sm text-slate-600">
            Mês visível:{" "}
            <span className="font-mono text-slate-800">
              {formatIsoDateRangePt(range.from, range.to)}
            </span>{" "}
            (Europe/Lisbon no controlo do mês)
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={prevMonth}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50"
          >
            ← Mês anterior
          </button>
          <span className="min-w-[100px] text-center text-sm font-semibold text-slate-800">
            {title}
          </span>
          <button
            type="button"
            onClick={nextMonth}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50"
          >
            Mês seguinte →
          </button>
        </div>
      </div>

      <div className="mt-4 max-w-md">
        <label className="block text-sm font-medium text-slate-700">
          Filtrar por funcionário
        </label>
        <select
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          value={employeeId}
          onChange={(e) => setEmployeeId(e.target.value)}
        >
          <option value="">Todos</option>
          {(employees ?? []).map((e) => (
            <option key={e.id} value={e.id}>
              {e.fullName}
            </option>
          ))}
        </select>
      </div>

      {error ? (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error instanceof Error ? error.message : "Erro ao carregar turnos."}{" "}
          <button
            type="button"
            className="underline"
            onClick={() => void refetch()}
          >
            Tentar outra vez
          </button>
        </div>
      ) : null}

      <p className="mt-2 text-xs text-slate-500">
        Legenda: fundo âmbar = conferência pendente; verde = conferência
        registada.
      </p>

      <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        {isPending ? (
          <SkeletonBlock className="h-[420px] w-full min-w-[720px]" />
        ) : (
          <div className="grid min-w-[720px] grid-cols-7 gap-px bg-slate-200">
            {WEEKDAYS.map((d) => (
              <div
                key={d}
                className="bg-slate-100 px-2 py-2 text-center text-xs font-semibold text-slate-600"
              >
                {d}
              </div>
            ))}
            {weeks.flatMap((row, ri) =>
              row.map((cell, ci) => {
                if (cell.kind === "empty") {
                  return (
                    <div
                      key={`e-${ri}-${ci}`}
                      className="min-h-[100px] bg-slate-50"
                    />
                  );
                }
                const list = byDate.get(cell.iso) ?? [];
                return (
                  <div
                    key={cell.iso}
                    className="min-h-[100px] bg-white p-2 align-top"
                  >
                    <div className="text-xs font-semibold text-slate-500">
                      {cell.day}
                    </div>
                    {list.length === 0 ? (
                      <p className="mt-1 text-xs text-slate-400">—</p>
                    ) : (
                      <ul className="mt-1 space-y-1">
                        {list.map((s) => (
                          <li
                            key={shiftKey(s)}
                            title={
                              isShiftAttendancePending(s)
                                ? "Conferência pendente"
                                : "Conferência registada"
                            }
                            className={`rounded border px-1.5 py-0.5 text-[11px] leading-snug text-slate-800 ${
                              isShiftAttendancePending(s)
                                ? "border-amber-200 bg-amber-50/90"
                                : "border-emerald-200 bg-emerald-50/90"
                            }`}
                          >
                            <span className="font-medium">
                              {nameById.get(s.employeeId) ??
                                s.employeeId.slice(0, 8)}
                            </span>
                            <br />
                            {s.startTime} – {s.endTime}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              }),
            )}
          </div>
        )}
      </div>
    </div>
  );
}
