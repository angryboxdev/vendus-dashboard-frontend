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

function formatSegments(s: WorkShift): string {
  const first = `${s.startTime}–${s.endTime}${s.endsNextDay ? " (+1 dia)" : ""}`;
  return s.secondStartTime && s.secondEndTime ? `${first} | ${s.secondStartTime}–${s.secondEndTime}` : first;
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
  const scheduledCount = new Set(dayShifts.map((s) => s.employeeId)).size;
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
            {dayShifts.map((s) => (
              <li key={s.id}>
                <button
                  onClick={() => onOpenShift(s)}
                  className="flex w-full items-start gap-2 rounded-md px-1.5 py-1 text-left hover:bg-stone-50"
                >
                  <span className={`mt-1 h-2 w-2 shrink-0 rounded-full border ${employeeColorClass(s.employeeId)}`} />
                  <span>
                    <span className="block text-sm font-medium text-stone-700">{shortName(s.employeeName)}</span>
                    <span className="block text-xs text-stone-500">{formatSegments(s)}</span>
                    <span className="block text-xs text-stone-400">{locationName(s.locationId)}</span>
                  </span>
                </button>
              </li>
            ))}
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
