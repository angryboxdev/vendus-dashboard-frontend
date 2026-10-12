import {
  IconAlert,
  IconPlus,
  ShiftCard,
  Skeleton,
} from "../../../../../components/ui/index.ts";
import {
  LEAVE_TYPE_LABELS,
  type LeaveOverviewEntry,
  type WorkShift,
} from "../../../domain/entities/schedule.ts";
import {
  timeRange,
  type ShiftVisualType,
} from "../../../domain/services/schedule-board.service.ts";
import type { VisualMode } from "./ScheduleToolbar.tsx";
import { attendanceIndicator } from "./attendance-indicator.ts";

const WEEKDAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const short = (n: string) => n.split(" ").slice(0, 2).join(" ");

/**
 * Vista de mês (mesmas funções de antes): "Detalhada" mostra cada turno com o
 * mesmo ShiftCard da semana; "Compacta" mostra o resumo do dia e abre o
 * painel do dia ao clicar.
 */
export function MonthBoard({
  days,
  month,
  todayYmd,
  visualMode,
  loading,
  toYmd,
  shiftsByDate,
  leavesByDate,
  holidaysByDate,
  conflictsByDate,
  employeeName,
  shiftLabel,
  onOpenShift,
  onNewShift,
  onSelectDay,
}: {
  days: Date[];
  month: number;
  todayYmd: string;
  visualMode: VisualMode;
  loading: boolean;
  toYmd: (d: Date) => string;
  shiftsByDate: Map<string, WorkShift[]>;
  leavesByDate: Map<string, LeaveOverviewEntry[]>;
  holidaysByDate: Map<string, { name: string }>;
  conflictsByDate: Map<string, number>;
  employeeName: (id: string) => string;
  shiftLabel: (s: WorkShift) => { title: string; tone: ShiftVisualType };
  onOpenShift: (s: WorkShift) => void;
  onNewShift: (ymd: string) => void;
  onSelectDay: (ymd: string) => void;
}) {
  return (
    <section
      aria-label="Escala do mês"
      className="overflow-hidden rounded-2.5xl border border-line bg-surface-card shadow-card motion-safe:animate-motion-fade-up [animation-delay:120ms]"
    >
      <div className="grid grid-cols-7 border-b border-line-subtle">
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className="px-2 py-3 text-center text-xs font-medium text-ink-secondary"
          >
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day, i) => {
          const ymd = toYmd(day);
          const inMonth = day.getMonth() === month;
          const dayShifts = shiftsByDate.get(ymd) ?? [];
          const dayLeaves = leavesByDate.get(ymd) ?? [];
          const holiday = holidaysByDate.get(ymd);
          const conflicts = conflictsByDate.get(ymd) ?? 0;
          const today = ymd === todayYmd;
          const base = `group relative min-h-[132px] border-b border-r border-line-subtle p-1.5 text-left [&:nth-child(7n)]:border-r-0 ${inMonth ? "" : "bg-surface-soft/40 opacity-60"} ${holiday ? "bg-amber-50/40" : ""}`;
          const dayNumber = (
            <span
              className={`flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs font-semibold tabular-nums ${today ? "bg-brand-600 text-white" : "text-navy-900"}`}
            >
              {day.getDate()}
            </span>
          );
          if (loading)
            return (
              <div key={ymd} className={base}>
                {dayNumber}
                {i % 3 === 0 && (
                  <Skeleton className="mt-2 h-10 w-full rounded-xl" />
                )}
              </div>
            );
          if (visualMode === "compact") {
            const people = new Set(dayShifts.map((s) => s.employeeId)).size;
            return (
              <button
                key={ymd}
                type="button"
                onClick={() => onSelectDay(ymd)}
                className={`${base} transition-colors duration-150 hover:bg-surface-soft/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500/40`}
              >
                <span className="flex items-center justify-between">
                  {dayNumber}
                  {conflicts > 0 && (
                    <span
                      className="flex items-center gap-1 text-[11px] font-medium text-amber-700"
                      title={`${conflicts} conflito(s)`}
                    >
                      <IconAlert size={12} /> {conflicts}
                    </span>
                  )}
                </span>
                {holiday && (
                  <span className="mt-0.5 block truncate text-[11px] font-medium text-amber-700">
                    {holiday.name}
                  </span>
                )}
                {(people > 0 || dayLeaves.length > 0) && (
                  <span className="mt-1 block truncate text-[11px] text-ink-secondary">
                    {people} escalado(s)
                    {dayLeaves.length > 0 &&
                      ` · ${dayLeaves.length} ausência(s)`}
                  </span>
                )}
                <span className="mt-1 block space-y-0.5">
                  {dayShifts.slice(0, 2).map((s) => (
                    <span
                      key={s.id}
                      className="block truncate text-[11px] text-ink tabular-nums"
                    >
                      {short(s.employeeName)} · {s.startTime}–{s.endTime}
                    </span>
                  ))}
                  {dayShifts.length > 2 && (
                    <span className="block text-[11px] font-medium text-brand-600">
                      +{dayShifts.length - 2} mais
                    </span>
                  )}
                </span>
              </button>
            );
          }
          return (
            <div key={ymd} className={base}>
              <div className="flex items-center justify-between">
                {dayNumber}
                <button
                  type="button"
                  onClick={() => onNewShift(ymd)}
                  aria-label={`Novo turno em ${ymd}`}
                  className="flex h-6 w-6 items-center justify-center rounded-md text-ink-muted opacity-0 transition duration-150 hover:bg-surface-soft hover:text-brand-600 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 group-hover:opacity-100"
                >
                  <IconPlus size={14} />
                </button>
              </div>
              {holiday && (
                <p className="mt-0.5 truncate text-[11px] font-medium text-amber-700">
                  {holiday.name}
                </p>
              )}
              <div className="mt-1 space-y-1">
                {dayShifts.map((s) => {
                  const { tone } = shiftLabel(s);
                  const times =
                    s.secondStartTime && s.secondEndTime
                      ? [
                          timeRange(s.startTime, s.endTime),
                          timeRange(s.secondStartTime, s.secondEndTime),
                        ]
                      : [timeRange(s.startTime, s.endTime)];
                  return (
                    <ShiftCard
                      key={s.id}
                      tone={tone}
                      title={short(s.employeeName)}
                      times={times}
                      status={s.status === "draft" ? "draft" : "published"}
                      onClick={() => onOpenShift(s)}
                      indicator={attendanceIndicator(s)}
                      tooltip={`${s.employeeName} · ${times.join(" | ")}${s.endsNextDay ? " (+1 dia)" : ""}${s.status === "draft" ? " · rascunho" : ""}`}
                      className="motion-safe:animate-motion-fade"
                    />
                  );
                })}
                {dayLeaves.map((l) => (
                  <div
                    key={l.id}
                    title={LEAVE_TYPE_LABELS[l.type]}
                    className="rounded-xl border border-line-subtle bg-surface-soft px-2.5 py-1.5 text-[11px] text-ink-secondary"
                  >
                    <span className="block truncate font-medium text-ink">
                      {short(employeeName(l.employeeId))}
                    </span>
                    {LEAVE_TYPE_LABELS[l.type]}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
