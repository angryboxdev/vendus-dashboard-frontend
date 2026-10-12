import { LEAVE_TYPE_LABELS, type LeaveOverviewEntry, type WorkShift } from "../../domain/entities/schedule.ts";

interface DaySummaryPanelProps {
  date: string;
  dayShifts: WorkShift[];
  dayLeaves: LeaveOverviewEntry[];
  conflictCount: number;
  /** Classes Tailwind (fundo + contorno da mesma paleta) para a bolinha de identificação do colaborador. */
  employeeColorClass: (employeeId: string) => string;
  locationName: (locationId: string) => string;
  shortName: (fullName: string) => string;
  onClose: () => void;
  onOpenShift: (shift: WorkShift) => void;
  onOpenDay: () => void;
  onEditSchedule: () => void;
}

interface DayPeriod {
  start: string;
  end: string;
  endsNextDay: boolean;
  locationId: string;
}

interface ConsolidatedEmployeeDay {
  employeeId: string;
  employeeName: string;
  /** Turnos originais deste colaborador neste dia — nunca fundidos na origem, só agrupados para exibição (task "Consolidar turnos repartidos", secção 10). */
  shifts: WorkShift[];
  /** Todos os períodos de todos os turnos, ordenados pela hora de início. */
  periods: DayPeriod[];
  /** Períodos sobrepostos — não impede a consolidação visual, só acrescenta o aviso (secção 7). */
  hasConflict: boolean;
}

function formatPeriod(p: DayPeriod): string {
  return `${p.start}–${p.end}${p.endsNextDay ? " (+1 dia)" : ""}`;
}

/**
 * 1 funcionário por dia = 1 item (task "Consolidar turnos repartidos no
 * Resumo do dia"). Junta os períodos de TODOS os turnos do colaborador
 * nesse dia — cobre tanto o caso comum (1 turno repartido = 1 registo com
 * 2 períodos) como o raro (2+ turnos avulsos no mesmo dia). Comparação de
 * strings "HH:mm" para ordenar/detetar sobreposição é só uma simplificação
 * documentada: um turno noturno (`endsNextDay`) combinado com outro turno
 * no mesmo dia civil pode escapar à deteção de conflito — caso raro,
 * aceite dado o volume da task.
 */
function consolidateByEmployee(shifts: WorkShift[]): ConsolidatedEmployeeDay[] {
  const byEmployee = new Map<string, WorkShift[]>();
  for (const s of shifts) {
    const list = byEmployee.get(s.employeeId) ?? [];
    list.push(s);
    byEmployee.set(s.employeeId, list);
  }

  const result: ConsolidatedEmployeeDay[] = [];
  for (const [employeeId, employeeShifts] of byEmployee) {
    const periods: DayPeriod[] = [];
    for (const s of employeeShifts) {
      periods.push({ start: s.startTime, end: s.endTime, endsNextDay: s.endsNextDay, locationId: s.locationId });
      if (s.secondStartTime && s.secondEndTime) {
        periods.push({ start: s.secondStartTime, end: s.secondEndTime, endsNextDay: false, locationId: s.locationId });
      }
    }
    periods.sort((a, b) => a.start.localeCompare(b.start));

    let hasConflict = false;
    for (let i = 0; i < periods.length - 1; i++) {
      if (periods[i]!.end > periods[i + 1]!.start) hasConflict = true;
    }

    result.push({ employeeId, employeeName: employeeShifts[0]!.employeeName, shifts: employeeShifts, periods, hasConflict });
  }

  result.sort((a, b) => a.periods[0]!.start.localeCompare(b.periods[0]!.start));
  return result;
}

/** "Resumo do dia" — só existe na visualização Compacta (task "Visualização Detalhada e Compacta"). Nunca altera dados ao abrir. */
export function DaySummaryPanel({
  date,
  dayShifts,
  dayLeaves,
  conflictCount,
  employeeColorClass,
  locationName,
  shortName,
  onClose,
  onOpenShift,
  onOpenDay,
  onEditSchedule,
}: DaySummaryPanelProps) {
  const consolidated = consolidateByEmployee(dayShifts);
  const scheduledCount = consolidated.length;
  const dateLabel = new Date(`${date}T00:00:00`).toLocaleDateString("pt-PT", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return (
    <aside className="h-fit space-y-3 rounded-xl border border-[#F5C992]/40 bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-sm font-semibold text-stone-800">Resumo do dia</h2>
          <p className="mt-0.5 text-xs capitalize text-stone-500">{dateLabel}</p>
        </div>
        <button onClick={onClose} className="rounded-md p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-600" title="Fechar">
          ✕
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg border border-stone-100 p-2">
          <p className="text-lg font-bold text-stone-800">{scheduledCount}</p>
          <p className="text-[10px] text-stone-500">Escalados</p>
        </div>
        <div className="rounded-lg border border-stone-100 p-2">
          <p className={`text-lg font-bold ${conflictCount > 0 ? "text-red-600" : "text-stone-800"}`}>{conflictCount}</p>
          <p className="text-[10px] text-stone-500">Conflito{conflictCount === 1 ? "" : "s"}</p>
        </div>
        <div className="rounded-lg border border-stone-100 p-2">
          <p className="text-lg font-bold text-stone-800">{dayLeaves.length}</p>
          <p className="text-[10px] text-stone-500">Ausências</p>
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-stone-400">Escala do dia</p>
        {dayShifts.length === 0 && dayLeaves.length === 0 ? (
          <p className="text-sm text-stone-400">Sem turnos neste dia.</p>
        ) : (
          <ul className="space-y-1.5">
            {consolidated.map((emp) => {
              const sameLocation = emp.periods.every((p) => p.locationId === emp.periods[0]!.locationId);
              return (
                <li key={emp.employeeId}>
                  <button
                    onClick={() => (emp.shifts.length === 1 ? onOpenShift(emp.shifts[0]!) : onOpenDay())}
                    className="flex w-full items-start gap-2 rounded-md px-1.5 py-1 text-left hover:bg-stone-50"
                  >
                    <span className={`mt-1 h-2 w-2 shrink-0 rounded-full border ${employeeColorClass(emp.employeeId)}`} />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-stone-700">{shortName(emp.employeeName)}</span>
                      {sameLocation ? (
                        <>
                          <span className="line-clamp-2 block text-xs text-stone-500">
                            {emp.periods.map((p) => formatPeriod(p)).join(" | ")}
                          </span>
                          <span className="block text-xs text-stone-400">{locationName(emp.periods[0]!.locationId)}</span>
                        </>
                      ) : (
                        emp.periods.map((p, i) => (
                          <span key={i} className="block text-xs text-stone-500">
                            {formatPeriod(p)} · {locationName(p.locationId)}
                          </span>
                        ))
                      )}
                      {emp.hasConflict ? (
                        <span className="mt-1 inline-block rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-700">
                          ⚠ Conflito de horário
                        </span>
                      ) : emp.periods.length >= 2 ? (
                        <span className="mt-1 inline-block rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                          Turno repartido
                        </span>
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })}
            {dayLeaves.map((l) => (
              <li key={l.id} className="flex items-start gap-2 px-1.5 py-1 text-xs text-stone-500">
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-sky-400" />
                <span>{LEAVE_TYPE_LABELS[l.type]}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {conflictCount > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
          {conflictCount} conflito{conflictCount === 1 ? "" : "s"} detetado{conflictCount === 1 ? "" : "s"}
        </div>
      )}

      <div className="flex gap-2 border-t border-stone-100 pt-3">
        <button
          onClick={onOpenDay}
          className="flex-1 rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50"
        >
          Abrir dia
        </button>
        <button
          onClick={onEditSchedule}
          className="flex-1 rounded-lg bg-gradient-to-r from-[#ED5C32] to-[#EF8935] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
        >
          Editar escala
        </button>
      </div>
    </aside>
  );
}
