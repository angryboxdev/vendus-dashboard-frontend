import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FOCUS_RING, IconChevronLeft, IconChevronRight } from "../../../../components/ui";
import type { MyShift } from "../../domain/entities/portal.ts";
import { addDays, dayLabel, mondayOf, shiftHours, weekLabel } from "../../domain/services/portal-text.service.ts";
import { useEmployeePortalModule } from "../../employee-portal.module.tsx";
import { todayLisbon } from "./portal-today.ts";

const CARD = "rounded-2.5xl border bg-surface-card shadow-card";
const WEEKDAY_SHORT = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

function Coworkers({ shiftId }: { shiftId: string }) {
  const { selfService } = useEmployeePortalModule();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["portal-coworkers", shiftId],
    queryFn: () => selfService.listCoworkers(shiftId),
    retry: false,
  });
  if (isLoading) return <p className="mt-2 text-xs text-ink-secondary">A carregar…</p>;
  if (isError) return <p className="mt-2 text-xs text-red-700">Não foi possível carregar os colegas.</p>;
  if (!data || data.length === 0) return <p className="mt-2 text-xs text-ink-secondary">Ninguém mais neste horário.</p>;
  return (
    <ul className="mt-2 space-y-1.5 border-t border-line-subtle pt-2" aria-label="Quem trabalha comigo">
      {data.map((c, i) => (
        <li key={i} className="flex items-baseline justify-between gap-2 text-sm">
          <span className="text-ink">
            {c.shortName}
            {c.positionName && <span className="text-ink-secondary"> · {c.positionName}</span>}
          </span>
          <span className="shrink-0 text-xs tabular-nums text-ink-secondary">{c.hours}</span>
        </li>
      ))}
    </ul>
  );
}

/** Cor do modelo do turno (é um dado da escala, por isso vem em `style`). */
const templateColor = (shift: MyShift | undefined) => (shift?.template?.color ? { backgroundColor: shift.template.color } : undefined);

function ShiftCard({ shift, today }: { shift: MyShift; today: string }) {
  const [open, setOpen] = useState(false);
  const isToday = shift.workDate === today;
  const where = [shift.locationName, shift.areaName].filter(Boolean).join(" · ");
  return (
    <li id={`dia-${shift.workDate}`} className={`${CARD} relative overflow-hidden p-4 pl-5 ${isToday ? "border-brand-500" : "border-line"}`}>
      <span aria-hidden className="absolute inset-y-0 left-0 w-1.5 bg-brand-600" style={templateColor(shift)} />
      <p className="text-base font-semibold tabular-nums text-navy-900">
        {dayLabel(shift.workDate, today)} · {shiftHours(shift)}
      </p>
      {shift.endsNextDay && <p className="text-xs text-ink-secondary">Termina no dia seguinte</p>}
      {shift.template && (
        <p className="mt-1 flex items-center gap-1.5 text-sm text-ink">
          <span aria-hidden className="inline-block h-2 w-2 rounded-full bg-brand-600" style={templateColor(shift)} />
          {shift.template.name}
        </p>
      )}
      {where && <p className="text-sm text-ink-secondary">{where}</p>}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={`-ml-1 mt-1 inline-flex min-h-11 items-center rounded-lg px-1 text-sm font-medium text-brand-600 ${FOCUS_RING}`}
      >
        {open ? "Esconder colegas" : "Quem trabalha comigo"}
      </button>
      {open && <Coworkers shiftId={shift.id} />}
    </li>
  );
}

function DayOffCard({ shift, today }: { shift: MyShift; today: string }) {
  return (
    <li id={`dia-${shift.workDate}`} className={`${CARD} border-dashed border-line bg-surface-soft p-4`}>
      <p className="text-base font-semibold text-navy-900">{dayLabel(shift.workDate, today)} · Folga</p>
      {shift.locationName && <p className="text-sm text-ink-secondary">{shift.locationName}</p>}
    </li>
  );
}

/** Tira da semana: um dia por coluna, com o estado (turno, folga ou nada publicado); toque leva ao dia. */
function WeekStrip({ days, shifts, today }: { days: string[]; shifts: MyShift[]; today: string }) {
  return (
    <ol className="grid grid-cols-7 gap-1.5" aria-label="Resumo da semana">
      {days.map((d, i) => {
        const items = shifts.filter((s) => s.workDate === d);
        const work = items.find((s) => s.kind !== "day_off");
        const state = work ? "turno" : items.length ? "folga" : "sem turno";
        return (
          <li key={d}>
            <button
              type="button"
              onClick={() => document.getElementById(`dia-${d}`)?.scrollIntoView?.({ behavior: "smooth", block: "center" })}
              aria-label={`${dayLabel(d, today)}: ${state}`}
              className={`flex min-h-16 w-full flex-col items-center justify-center gap-1 rounded-2xl border text-xs ${FOCUS_RING} ${d === today ? "border-brand-500 bg-brand-50" : "border-line bg-surface-card"}`}
            >
              <span className="font-medium text-ink-secondary">{WEEKDAY_SHORT[i]}</span>
              <span className="text-sm font-semibold tabular-nums text-navy-900">{Number(d.slice(8, 10))}</span>
              <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${work ? "bg-brand-600" : items.length ? "bg-ink-muted" : "bg-transparent"}`} style={templateColor(work)} />
            </button>
          </li>
        );
      })}
    </ol>
  );
}

/** A minha escala — semana a semana, só o publicado: turnos, folgas e dias sem escala. */
export function PortalScheduleView() {
  const { selfService } = useEmployeePortalModule();
  const today = todayLisbon();
  const [monday, setMonday] = useState(() => mondayOf(today));
  const sunday = addDays(monday, 6);
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["portal-shifts", monday],
    queryFn: () => selfService.listShifts(monday, sunday),
    retry: false,
  });
  const isCurrentWeek = monday === mondayOf(today);
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const navBtn = `inline-flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-surface-card text-navy-900 ${FOCUS_RING}`;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={() => setMonday(addDays(monday, -7))} className={navBtn} aria-label="Semana anterior">
          <IconChevronLeft size={20} />
        </button>
        <div className="text-center">
          <h1 className="text-lg font-bold text-navy-900">{isCurrentWeek ? "Esta semana" : "Semana"}</h1>
          <p className="text-xs tabular-nums text-ink-secondary">{weekLabel(monday)}</p>
        </div>
        <button type="button" onClick={() => setMonday(addDays(monday, 7))} className={navBtn} aria-label="Semana seguinte">
          <IconChevronRight size={20} />
        </button>
      </div>
      {!isCurrentWeek && (
        <div className="text-center">
          <button type="button" onClick={() => setMonday(mondayOf(today))} className={`min-h-11 rounded-full px-4 text-sm font-medium text-brand-600 ${FOCUS_RING}`}>
            Voltar a esta semana
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3" aria-busy="true">
          <p className="sr-only">A carregar…</p>
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2.5xl bg-surface-soft motion-reduce:animate-none" />
          ))}
        </div>
      ) : isError ? (
        <section role="alert" className={`${CARD} border-red-200 p-5 text-center text-sm`}>
          <p className="text-red-700">Não foi possível carregar a escala.</p>
          <button
            type="button"
            onClick={() => void refetch()}
            disabled={isFetching}
            className={`mt-2 min-h-11 rounded-xl border border-line px-4 text-sm font-medium text-navy-900 disabled:opacity-50 ${FOCUS_RING}`}
          >
            Tentar novamente
          </button>
        </section>
      ) : !data || data.length === 0 ? (
        <section className={`${CARD} border-line p-6 text-center text-sm text-ink-secondary`}>Sem turnos publicados nesta semana.</section>
      ) : (
        <>
          <WeekStrip days={days} shifts={data} today={today} />
          <ul className="space-y-3">
            {days.flatMap((d) => {
              const items = data.filter((s) => s.workDate === d);
              if (!items.length)
                return [
                  <li key={d} id={`dia-${d}`} className="flex min-h-11 items-center rounded-2xl border border-dashed border-line px-4 text-sm text-ink-secondary">
                    {dayLabel(d, today)} · Sem turno publicado
                  </li>,
                ];
              return items.map((s) => (s.kind === "day_off" ? <DayOffCard key={s.id} shift={s} today={today} /> : <ShiftCard key={s.id} shift={s} today={today} />));
            })}
          </ul>
        </>
      )}
    </div>
  );
}
