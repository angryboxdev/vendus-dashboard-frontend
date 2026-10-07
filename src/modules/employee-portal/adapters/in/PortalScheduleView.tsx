import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { MyShift } from "../../domain/entities/portal.ts";
import { addDays, dayLabel, mondayOf, shiftHours, weekLabel } from "../../domain/services/portal-text.service.ts";
import { useEmployeePortalModule } from "../../employee-portal.module.tsx";
import { todayLisbon } from "./portal-today.ts";

function Coworkers({ shiftId }: { shiftId: string }) {
  const { selfService } = useEmployeePortalModule();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["portal-coworkers", shiftId],
    queryFn: () => selfService.listCoworkers(shiftId),
    retry: false,
  });
  if (isLoading) return <p className="mt-2 text-xs text-stone-500">A carregar…</p>;
  if (isError) return <p className="mt-2 text-xs text-red-700">Não foi possível carregar os colegas.</p>;
  if (!data || data.length === 0) return <p className="mt-2 text-xs text-stone-500">Ninguém mais neste horário.</p>;
  return (
    <ul className="mt-2 space-y-1" aria-label="Quem trabalha comigo">
      {data.map((c, i) => (
        <li key={i} className="flex items-baseline justify-between gap-2 text-sm">
          <span className="text-stone-800">
            {c.shortName}
            {c.positionName && <span className="text-stone-500"> · {c.positionName}</span>}
          </span>
          <span className="shrink-0 text-xs text-stone-500">{c.hours}</span>
        </li>
      ))}
    </ul>
  );
}

function ShiftCard({ shift, today }: { shift: MyShift; today: string }) {
  const [open, setOpen] = useState(false);
  const isToday = shift.workDate === today;
  return (
    <li className={`rounded-2xl border bg-white p-4 shadow-sm ${isToday ? "border-[#ED5C32]" : "border-[#F5C992]/50"}`}>
      <p className="text-sm font-semibold text-stone-900">
        {dayLabel(shift.workDate, today)} · {shiftHours(shift)}
        {shift.endsNextDay && <span className="font-normal text-stone-500"> (termina no dia seguinte)</span>}
      </p>
      <p className="text-sm text-stone-600">{shift.locationName}</p>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="mt-2 text-xs font-medium text-[#ED5C32]">
        {open ? "Esconder colegas" : "Quem trabalha comigo"}
      </button>
      {open && <Coworkers shiftId={shift.id} />}
    </li>
  );
}

/** A minha escala — semana a semana, só turnos publicados (ticket 07). */
export function PortalScheduleView() {
  const { selfService } = useEmployeePortalModule();
  const today = todayLisbon();
  const [monday, setMonday] = useState(() => mondayOf(today));
  const sunday = addDays(monday, 6);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["portal-shifts", monday],
    queryFn: () => selfService.listShifts(monday, sunday),
    retry: false,
  });
  const isCurrentWeek = monday === mondayOf(today);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => setMonday(addDays(monday, -7))} className="rounded-lg px-3 py-2 text-sm text-stone-600" aria-label="Semana anterior">
          ‹
        </button>
        <div className="text-center">
          <h1 className="text-base font-semibold text-stone-900">{isCurrentWeek ? "Esta semana" : "Semana"}</h1>
          <p className="text-xs text-stone-500">{weekLabel(monday)}</p>
        </div>
        <button type="button" onClick={() => setMonday(addDays(monday, 7))} className="rounded-lg px-3 py-2 text-sm text-stone-600" aria-label="Semana seguinte">
          ›
        </button>
      </div>
      {!isCurrentWeek && (
        <button type="button" onClick={() => setMonday(mondayOf(today))} className="text-xs font-medium text-[#ED5C32]">
          Voltar a esta semana
        </button>
      )}

      {isLoading ? (
        <p className="text-sm text-stone-500">A carregar…</p>
      ) : isError ? (
        <p className="text-sm text-red-700">Não foi possível carregar a escala.</p>
      ) : !data || data.length === 0 ? (
        <section className="rounded-2xl border border-[#F5C992]/50 bg-white p-5 text-center text-sm text-stone-600 shadow-sm">Sem turnos publicados nesta semana.</section>
      ) : (
        <ul className="space-y-3">
          {data.map((s) => (
            <ShiftCard key={s.id} shift={s} today={today} />
          ))}
        </ul>
      )}
    </div>
  );
}
