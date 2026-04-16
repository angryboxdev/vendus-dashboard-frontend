import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  createLeaveRequest,
  deleteLeaveRequest,
  fetchEmployees,
  fetchLeaveOverview,
  fetchPublicHolidays,
} from "./hrApi";
import { hrQueryKeys } from "./hrQueryKeys";
import type { HrEmployee, HrPublicHoliday, LeaveType } from "./hr.types";
import {
  LEAVE_TYPE_COLORS,
  LEAVE_TYPE_LABELS,
} from "./hr.types";
import { getTodayLisbon } from "./dates";
import { buildMonthCalendarCells } from "./dates";

// ---------- constants ----------

const MONTHS = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];

const WEEKDAYS = ["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"];

const LEAVE_TYPES: LeaveType[] = ["vacation", "sick_leave", "justified", "unjustified"];

// ---------- Legal legend ----------

function LegalLegend() {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-sm font-semibold text-amber-800">
          Regras legais — Código do Trabalho (Portugal)
        </span>
        <svg className={`h-4 w-4 text-amber-600 transition-transform ${open ? "rotate-180" : ""}`} viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z" clipRule="evenodd" />
        </svg>
      </button>
      {open && (
        <div className="border-t border-amber-200 px-4 pb-4 pt-3">
          <ul className="space-y-2 text-xs text-amber-900">
            <li className="flex gap-2">
              <span className="mt-px text-amber-600">•</span>
              <span><strong>1.º ano:</strong> 2 dias úteis por mês completo trabalhado, máx. 20 dias. Só podem ser gozados após 6 meses de contrato (art. 238 CT).</span>
            </li>
            <li className="flex gap-2">
              <span className="mt-px text-amber-600">•</span>
              <span><strong>Anos seguintes:</strong> 22 dias úteis de férias (mínimo legal). O período é definido por acordo entre empregador e trabalhador, preferencialmente entre junho e setembro.</span>
            </li>
            <li className="flex gap-2">
              <span className="mt-px text-amber-600">•</span>
              <span><strong>Transição de ano:</strong> Férias não gozadas podem transitar para o ano seguinte, mas têm de ser gozadas até 30 de abril. Após essa data perdem-se (salvo acordo escrito).</span>
            </li>
            <li className="flex gap-2">
              <span className="mt-px text-amber-600">•</span>
              <span><strong>Feriados obrigatórios:</strong> Se o funcionário trabalhar num feriado nacional, tem direito a um dia de descanso compensatório remunerado (art. 269 CT).</span>
            </li>
            <li className="flex gap-2">
              <span className="mt-px text-amber-600">•</span>
              <span><strong>Baixa médica:</strong> Os primeiros 3 dias são pagos pelo empregador (período de espera). A partir do 4.º dia, a Segurança Social paga 65% da remuneração de referência.</span>
            </li>
            <li className="flex gap-2">
              <span className="mt-px text-amber-600">•</span>
              <span><strong>Falta injustificada:</strong> Desconta no salário e pode implicar perda de antiguidade (até 30 dias por ano).</span>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}

// ---------- Leave form modal ----------

function LeaveFormModal({
  employees,
  onClose,
}: {
  employees: HrEmployee[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const today = getTodayLisbon();
  const [employeeId, setEmployeeId] = useState(employees[0]?.id ?? "");
  const [type, setType] = useState<LeaveType>("vacation");
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      createLeaveRequest(employeeId, { type, startDate, endDate, notes: notes || null }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: hrQueryKeys.root });
      onClose();
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Erro"),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h3 className="text-base font-semibold text-slate-900">Registar ausência</h3>
        <div className="mt-4 flex flex-col gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Funcionário</label>
            <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500">
              {employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.fullName}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Tipo</label>
            <select value={type} onChange={(e) => setType(e.target.value as LeaveType)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500">
              {LEAVE_TYPES.map((t) => <option key={t} value={t}>{LEAVE_TYPE_LABELS[t]}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Início</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Fim</label>
              <input type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Notas</label>
            <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opcional"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
          </div>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Cancelar
          </button>
          <button type="button" disabled={mutation.isPending || !employeeId}
            onClick={() => mutation.mutate()}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
            {mutation.isPending ? "A guardar…" : "Registar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- Calendar cell helpers ----------

function isBetween(date: string, start: string, end: string) {
  return date >= start && date <= end;
}

// ---------- Main ----------

export function HrLeavePage() {
  const today = getTodayLisbon();
  const currentYear = Number(today.slice(0, 4));
  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState(Number(today.slice(5, 7)) - 1); // 0-indexed
  const [filterType, setFilterType] = useState<LeaveType | "">("");
  const [filterEmployee, setFilterEmployee] = useState("");
  const [creating, setCreating] = useState(false);
  const qc = useQueryClient();

  const { data: employees } = useQuery({
    queryKey: hrQueryKeys.employees({ limit: 500, offset: 0 }),
    queryFn: () => fetchEmployees({ limit: 500, offset: 0 }),
  });

  const { data: leaves = [] } = useQuery({
    queryKey: hrQueryKeys.leaveOverview(year),
    queryFn: () => fetchLeaveOverview(year),
  });

  const { data: holidays = [] } = useQuery({
    queryKey: hrQueryKeys.publicHolidays(year),
    queryFn: () => fetchPublicHolidays(year),
  });

  const holidaySet = useMemo(() => {
    const s = new Map<string, string>();
    (holidays as HrPublicHoliday[]).forEach((h) => s.set(h.date, h.name));
    return s;
  }, [holidays]);

  const employeeMap = useMemo(() => {
    const m = new Map<string, string>();
    (employees ?? []).forEach((e) => m.set(e.id, e.fullName));
    return m;
  }, [employees]);

  const filteredLeaves = useMemo(() => {
    return leaves.filter((l) => {
      if (filterType && l.type !== filterType) return false;
      if (filterEmployee && l.employeeId !== filterEmployee) return false;
      return true;
    });
  }, [leaves, filterType, filterEmployee]);

  const cells = useMemo(
    () => buildMonthCalendarCells(year, month + 1).flat(),
    [year, month],
  );

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteLeaveRequest(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: hrQueryKeys.root }),
  });

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  }

  // Leaves that overlap with current month
  const monthStart = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const monthEnd = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  const monthLeaves = filteredLeaves.filter(
    (l) => l.startDate <= monthEnd && l.endDate >= monthStart,
  );

  return (
    <div className="mx-auto max-w-5xl p-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Férias & Ausências</h2>
          <p className="mt-1 text-sm text-slate-500">Visão global da equipa.</p>
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          Registar ausência
        </button>
      </div>

      {/* Legal legend */}
      <div className="mt-4">
        <LegalLegend />
      </div>

      {/* Filters */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <select value={filterEmployee} onChange={(e) => setFilterEmployee(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500">
          <option value="">Todos os funcionários</option>
          {(employees ?? []).map((e) => <option key={e.id} value={e.id}>{e.fullName}</option>)}
        </select>

        <div className="flex overflow-hidden rounded-lg border border-slate-300 text-sm">
          <button type="button" onClick={() => setFilterType("")}
            className={`px-3 py-1.5 font-medium transition-colors ${filterType === "" ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}>
            Tudo
          </button>
          {LEAVE_TYPES.map((t) => (
            <button key={t} type="button" onClick={() => setFilterType(t)}
              className={`px-3 py-1.5 font-medium transition-colors ${filterType === t ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}>
              {LEAVE_TYPE_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      {/* Calendar */}
      <div className="mt-5 rounded-xl border border-slate-200 bg-white shadow-sm">
        {/* Month nav */}
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <button type="button" onClick={prevMonth}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100">
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
            </svg>
          </button>
          <span className="text-sm font-semibold capitalize text-slate-800">
            {MONTHS[month]} {year}
          </span>
          <button type="button" onClick={nextMonth}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100">
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* Weekday headers */}
        <div className="grid grid-cols-7 border-b border-slate-100">
          {WEEKDAYS.map((w) => (
            <div key={w} className="py-2 text-center text-xs font-semibold text-slate-500">{w}</div>
          ))}
        </div>

        {/* Cells */}
        <div className="grid grid-cols-7">
          {cells.map((cell, idx) => {
            if (cell.kind === "empty") {
              return <div key={`e-${idx}`} className="min-h-[72px] border-b border-r border-slate-100 bg-slate-50" />;
            }
            const isToday = cell.iso === today;
            const isHoliday = holidaySet.has(cell.iso);
            const holidayName = holidaySet.get(cell.iso);
            const dayLeaves = monthLeaves.filter((l) => isBetween(cell.iso, l.startDate, l.endDate));

            return (
              <div
                key={cell.iso}
                className={`min-h-[72px] border-b border-r border-slate-100 p-1.5 ${
                  isHoliday ? "bg-amber-50" : ""
                }`}
              >
                <div className="flex items-start justify-between">
                  <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                    isToday ? "bg-indigo-600 text-white" : "text-slate-700"
                  }`}>
                    {cell.day}
                  </span>
                  {isHoliday && (
                    <span title={holidayName} className="text-[9px] font-semibold text-amber-600">F</span>
                  )}
                </div>
                {isHoliday && (
                  <p className="mt-0.5 truncate text-[9px] text-amber-700">{holidayName}</p>
                )}
                {dayLeaves.slice(0, 2).map((l) => (
                  <div key={l.id}
                    className={`mt-0.5 truncate rounded px-1 py-0.5 text-[10px] font-medium ring-1 ${LEAVE_TYPE_COLORS[l.type]}`}>
                    {employeeMap.get(l.employeeId) ?? "—"}
                  </div>
                ))}
                {dayLeaves.length > 2 && (
                  <p className="mt-0.5 text-[10px] text-slate-400">+{dayLeaves.length - 2}</p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Leave list */}
      <div className="mt-6">
        <h3 className="mb-3 text-sm font-semibold text-slate-700">
          {MONTHS[month]} {year} — {monthLeaves.length} registo{monthLeaves.length !== 1 ? "s" : ""}
        </h3>
        {monthLeaves.length === 0 ? (
          <p className="text-sm text-slate-400">Sem ausências registadas para este período.</p>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">Funcionário</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Período</th>
                  <th className="px-4 py-3">Dias úteis</th>
                  <th className="px-4 py-3">Notas</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {monthLeaves.map((l) => (
                  <tr key={l.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {employeeMap.get(l.employeeId) ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${LEAVE_TYPE_COLORS[l.type]}`}>
                        {LEAVE_TYPE_LABELS[l.type]}
                      </span>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-slate-600">
                      {l.startDate === l.endDate
                        ? l.startDate
                        : `${l.startDate} → ${l.endDate}`}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-slate-600">{l.workingDays}</td>
                    <td className="px-4 py-3 text-slate-500">{l.notes ?? "—"}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        disabled={deleteMutation.isPending}
                        onClick={() => {
                          if (confirm("Remover este registo?")) deleteMutation.mutate(l.id);
                        }}
                        className="text-red-500 hover:underline disabled:opacity-50"
                      >
                        Remover
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {creating && (
        <LeaveFormModal employees={employees ?? []} onClose={() => setCreating(false)} />
      )}
    </div>
  );
}
