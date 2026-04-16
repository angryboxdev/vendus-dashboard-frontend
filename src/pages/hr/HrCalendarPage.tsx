import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import {
  addDaysToYmd,
  buildMonthCalendarCells,
  getCivilMonthRangeIso,
  getCurrentYearMonthLisbon,
  getMondayOfWeek,
  getTodayLisbon,
} from "./dates";
import { fetchEmployees, fetchLeaveOverview, fetchShifts } from "./hrApi";
import { hrQueryKeys } from "./hrQueryKeys";
import {
  isShiftAttendancePending,
  LEAVE_TYPE_CALENDAR_COLORS,
  LEAVE_TYPE_LABELS,
  type HrLeaveRequest,
  type HrWorkShift,
} from "./hr.types";
import { SkeletonBlock } from "./components/SkeletonBlock";

// ---------- constants ----------

const WEEKDAYS_SHORT = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

const MONTHS_SHORT = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

const PALETTE = [
  { bg: "bg-indigo-100", border: "border-indigo-200", text: "text-indigo-900" },
  { bg: "bg-violet-100", border: "border-violet-200", text: "text-violet-900" },
  { bg: "bg-pink-100",   border: "border-pink-200",   text: "text-pink-900"   },
  { bg: "bg-teal-100",   border: "border-teal-200",   text: "text-teal-900"   },
  { bg: "bg-orange-100", border: "border-orange-200", text: "text-orange-900" },
  { bg: "bg-sky-100",    border: "border-sky-200",    text: "text-sky-900"    },
  { bg: "bg-rose-100",   border: "border-rose-200",   text: "text-rose-900"   },
  { bg: "bg-lime-100",   border: "border-lime-200",   text: "text-lime-900"   },
] as const;

type PaletteEntry = (typeof PALETTE)[number];

type ViewMode = "month" | "week";

// ---------- helpers ----------

function fmtDayMonth(iso: string): string {
  const [, mo, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS_SHORT[mo - 1]}`;
}

// ---------- sub-components ----------

function ShiftPill({
  shift,
  name,
  color,
}: {
  shift: HrWorkShift;
  name: string;
  color: PaletteEntry;
}) {
  const pending = isShiftAttendancePending(shift);
  return (
    <div
      title={pending ? "Conferência pendente" : "Conferência registada"}
      className={`rounded border px-1.5 py-0.5 text-[11px] leading-snug ${color.bg} ${color.border} ${color.text}`}
    >
      <div className="flex items-center gap-1">
        <span
          className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${
            pending ? "bg-amber-500" : "bg-emerald-500"
          }`}
        />
        <span className="truncate font-medium">{name}</span>
      </div>
      <div className="mt-0.5 text-[10px] opacity-70">
        {shift.startTime} – {shift.endTime}
      </div>
    </div>
  );
}

function LeavePill({
  leave,
  name,
}: {
  leave: HrLeaveRequest;
  name: string;
}) {
  return (
    <div
      title={LEAVE_TYPE_LABELS[leave.type]}
      className={`rounded border px-1.5 py-0.5 text-[11px] leading-snug ${LEAVE_TYPE_CALENDAR_COLORS[leave.type]}`}
    >
      <div className="truncate font-medium">{name}</div>
      <div className="mt-0.5 text-[10px] opacity-70">{LEAVE_TYPE_LABELS[leave.type]}</div>
    </div>
  );
}

function DayCell({
  iso,
  todayIso,
  shifts,
  leaves,
  nameById,
  colorById,
  tall,
}: {
  iso: string;
  todayIso: string;
  shifts: HrWorkShift[];
  leaves: HrLeaveRequest[];
  nameById: Map<string, string>;
  colorById: Map<string, PaletteEntry>;
  tall?: boolean;
}) {
  const isToday = iso === todayIso;
  const [, , d] = iso.split("-").map(Number);
  const isEmpty = shifts.length === 0 && leaves.length === 0;

  return (
    <div
      className={`bg-white p-2 align-top ${tall ? "min-h-[180px]" : "min-h-[100px]"} ${
        isToday ? "ring-2 ring-inset ring-indigo-400" : ""
      }`}
    >
      <div
        className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-semibold ${
          isToday
            ? "bg-indigo-600 text-white"
            : "text-slate-500"
        }`}
      >
        {d}
      </div>
      {isEmpty ? (
        <p className="mt-1 text-xs text-slate-400">—</p>
      ) : (
        <ul className="mt-1 space-y-1">
          {shifts.map((s) => (
            <li key={`shift-${s.id}`}>
              <ShiftPill
                shift={s}
                name={nameById.get(s.employeeId) ?? s.employeeId.slice(0, 8)}
                color={colorById.get(s.employeeId) ?? PALETTE[0]}
              />
            </li>
          ))}
          {leaves.map((l) => (
            <li key={`leave-${l.id}-${iso}`}>
              <LeavePill
                leave={l}
                name={nameById.get(l.employeeId) ?? l.employeeId.slice(0, 8)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------- main component ----------

export function HrCalendarPage() {
  const initial = getCurrentYearMonthLisbon();
  const todayIso = useMemo(() => getTodayLisbon(), []);

  const [view, setView] = useState<ViewMode>("month");
  const [year, setYear] = useState(initial.year);
  const [month, setMonth] = useState(initial.month);
  const [weekMonday, setWeekMonday] = useState(() => getMondayOfWeek(getTodayLisbon()));
  const [employeeId, setEmployeeId] = useState<string>("");

  // Ranges
  const monthRange = useMemo(() => getCivilMonthRangeIso(year, month), [year, month]);
  const weekRange = useMemo(
    () => ({ from: weekMonday, to: addDaysToYmd(weekMonday, 6) }),
    [weekMonday],
  );
  const range = view === "month" ? monthRange : weekRange;

  const shiftsParams = useMemo(
    () => ({
      from: range.from,
      to: range.to,
      ...(employeeId ? { employeeId } : {}),
    }),
    [range.from, range.to, employeeId],
  );

  // Queries
  const { data: employees } = useQuery({
    queryKey: hrQueryKeys.employees({ limit: 500, offset: 0 }),
    queryFn: () => fetchEmployees({ limit: 500, offset: 0 }),
  });

  const { data: shifts, isPending, error, refetch } = useQuery({
    queryKey: hrQueryKeys.shifts(shiftsParams),
    queryFn: () => fetchShifts(shiftsParams),
  });

  const { data: leaves } = useQuery({
    queryKey: hrQueryKeys.leaveOverview(year),
    queryFn: () => fetchLeaveOverview(year),
  });

  // Maps
  const nameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of employees ?? []) m.set(e.id, e.fullName);
    return m;
  }, [employees]);

  const colorById = useMemo(() => {
    const m = new Map<string, PaletteEntry>();
    (employees ?? []).forEach((e, i) => m.set(e.id, PALETTE[i % PALETTE.length]));
    return m;
  }, [employees]);

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

  // Expand each leave request across its date range, filtered to visible range
  const leavesByDate = useMemo(() => {
    const map = new Map<string, HrLeaveRequest[]>();
    for (const leave of leaves ?? []) {
      let cur = leave.startDate;
      while (cur <= leave.endDate) {
        if (cur >= range.from && cur <= range.to) {
          const list = map.get(cur) ?? [];
          list.push(leave);
          map.set(cur, list);
        }
        cur = addDaysToYmd(cur, 1);
        if (cur > range.to) break;
      }
    }
    return map;
  }, [leaves, range.from, range.to]);

  // Month grid
  const weeks = useMemo(() => buildMonthCalendarCells(year, month), [year, month]);

  // Week days array
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDaysToYmd(weekMonday, i)),
    [weekMonday],
  );

  // Navigation
  function prevMonth() {
    if (month <= 1) { setYear((y) => y - 1); setMonth(12); }
    else setMonth((m) => m - 1);
  }
  function nextMonth() {
    if (month >= 12) { setYear((y) => y + 1); setMonth(1); }
    else setMonth((m) => m + 1);
  }
  function prevWeek() { setWeekMonday((w) => addDaysToYmd(w, -7)); }
  function nextWeek() { setWeekMonday((w) => addDaysToYmd(w, 7)); }

  // Labels
  const monthLabel = `${String(month).padStart(2, "0")} / ${year}`;
  const weekLabel = `${fmtDayMonth(weekMonday)} – ${fmtDayMonth(addDaysToYmd(weekMonday, 6))} ${weekMonday.slice(0, 4)}`;

  return (
    <div className="mx-auto max-w-6xl p-6">
      {/* Header row */}
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 pb-4">
        <h2 className="flex-1 text-xl font-semibold text-slate-900">
          Calendário de turnos
        </h2>

        {/* View toggle */}
        <div className="flex rounded-lg border border-slate-300 bg-white overflow-hidden text-sm">
          <button
            type="button"
            onClick={() => setView("month")}
            className={`px-3 py-1.5 font-medium transition-colors ${
              view === "month"
                ? "bg-indigo-600 text-white"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            Mês
          </button>
          <button
            type="button"
            onClick={() => setView("week")}
            className={`px-3 py-1.5 font-medium transition-colors ${
              view === "week"
                ? "bg-indigo-600 text-white"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            Semana
          </button>
        </div>

        {/* Navigation */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={view === "month" ? prevMonth : prevWeek}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
          >
            ←
          </button>
          <span className="min-w-[9rem] text-center text-sm font-medium text-slate-700">
            {view === "month" ? monthLabel : weekLabel}
          </span>
          <button
            type="button"
            onClick={view === "month" ? nextMonth : nextWeek}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
          >
            →
          </button>
        </div>
      </div>

      {/* Employee filter badges */}
      {employees && employees.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setEmployeeId("")}
            className={`rounded-full border px-3 py-0.5 text-xs font-medium transition-colors ${
              employeeId === ""
                ? "border-slate-700 bg-slate-700 text-white"
                : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            Todos
          </button>
          {employees.map((e, i) => {
            const c = PALETTE[i % PALETTE.length];
            const active = employeeId === e.id;
            return (
              <button
                key={e.id}
                type="button"
                onClick={() => setEmployeeId(active ? "" : e.id)}
                className={`inline-flex items-center gap-1 rounded-full border px-3 py-0.5 text-xs font-medium transition-all ${
                  active
                    ? `${c.bg} ${c.border} ${c.text} ring-2 ring-offset-1 ring-current`
                    : `${c.bg} ${c.border} ${c.text} opacity-60 hover:opacity-100`
                }`}
              >
                {e.fullName.split(" ")[0]}
              </button>
            );
          })}
        </div>
      )}

      {/* Legend */}
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-amber-500" />
          Pendente
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          Conferido
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded border border-teal-200 bg-teal-50" />
          Férias
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded border border-orange-200 bg-orange-50" />
          Baixa médica
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded border border-blue-200 bg-blue-50" />
          Falta justificada
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded border border-red-200 bg-red-50" />
          Falta injustificada
        </span>
      </div>

      {error ? (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error instanceof Error ? error.message : "Erro ao carregar turnos."}{" "}
          <button type="button" className="underline" onClick={() => void refetch()}>
            Tentar outra vez
          </button>
        </div>
      ) : null}

      {/* Calendar grid */}
      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        {isPending ? (
          <SkeletonBlock className="h-[420px] w-full min-w-[720px]" />
        ) : view === "month" ? (
          /* ---- MONTH VIEW ---- */
          <div className="grid min-w-[720px] grid-cols-7 gap-px bg-slate-200">
            {WEEKDAYS_SHORT.map((d) => (
              <div
                key={d}
                className="bg-slate-50 px-2 py-2 text-center text-xs font-semibold text-slate-600"
              >
                {d}
              </div>
            ))}
            {weeks.flatMap((row, ri) =>
              row.map((cell, ci) => {
                if (cell.kind === "empty") {
                  return <div key={`e-${ri}-${ci}`} className="min-h-[100px] bg-slate-50" />;
                }
                const dayLeaves = (leavesByDate.get(cell.iso) ?? []).filter(
                  (l) => !employeeId || l.employeeId === employeeId,
                );
                return (
                  <DayCell
                    key={cell.iso}
                    iso={cell.iso}
                    todayIso={todayIso}
                    shifts={byDate.get(cell.iso) ?? []}
                    leaves={dayLeaves}
                    nameById={nameById}
                    colorById={colorById}
                  />
                );
              }),
            )}
          </div>
        ) : (
          /* ---- WEEK VIEW ---- */
          <div className="grid min-w-[720px] grid-cols-7 gap-px bg-slate-200">
            {weekDays.map((iso, i) => {
              const isToday = iso === todayIso;
              const [, mo, d] = iso.split("-").map(Number);
              return (
                <div
                  key={iso}
                  className={`px-2 py-2 text-center text-xs font-semibold ${
                    isToday
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-50 text-slate-600"
                  }`}
                >
                  <div>{WEEKDAYS_SHORT[i]}</div>
                  <div className={`text-base font-bold ${isToday ? "text-white" : "text-slate-800"}`}>
                    {d}
                  </div>
                  <div className={`text-[10px] ${isToday ? "text-indigo-200" : "text-slate-400"}`}>
                    {MONTHS_SHORT[mo - 1]}
                  </div>
                </div>
              );
            })}
            {weekDays.map((iso) => {
              const dayLeaves = (leavesByDate.get(iso) ?? []).filter(
                (l) => !employeeId || l.employeeId === employeeId,
              );
              return (
                <DayCell
                  key={iso}
                  iso={iso}
                  todayIso={todayIso}
                  shifts={byDate.get(iso) ?? []}
                  leaves={dayLeaves}
                  nameById={nameById}
                  colorById={colorById}
                  tall
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
