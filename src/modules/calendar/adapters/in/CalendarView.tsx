import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../../contexts/AuthContext.tsx";
import { useLocations } from "../../../locations/adapters/in/use-locations.ts";
import {
  KIND_LABELS,
  PRIORITY_LABELS,
  type CalendarFilter,
  type CalendarItem,
  type CalendarItemKind,
  type EventPriority,
} from "../../domain/entities/calendar-item.ts";
import {
  addDays,
  addMonths,
  itemsByDate,
  monthGrid,
  monthTitle,
  shortDate,
  visibleRange,
  weekDays,
} from "../../domain/services/calendar-grid.service.ts";
import { EventDrawer, HolidayDrawer, ImportHolidaysModal } from "./CalendarDialogs.tsx";
import { useCalendarItems, useUpcomingImportant } from "./use-calendar.ts";

const WEEKDAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

function itemClasses(item: CalendarItem): string {
  if (item.kind === "holiday") return "bg-amber-50 text-amber-800 border-amber-200";
  if (item.kind === "deadline") return "bg-violet-50 text-violet-800 border-violet-200";
  if (item.priority === "critical") return "bg-red-50 text-red-800 border-red-200";
  if (item.priority === "important") return "bg-orange-50 text-orange-800 border-orange-200";
  return "bg-sky-50 text-sky-800 border-sky-200";
}

function itemLabel(item: CalendarItem): string {
  return item.allDay || !item.startTime ? item.title : `${item.startTime} ${item.title}`;
}

type Dialog =
  | { kind: "none" }
  | { kind: "event"; item: CalendarItem | null; date: string }
  | { kind: "holiday"; item: CalendarItem | null; date: string }
  | { kind: "import" };

/**
 * Empresa & Estrutura → Calendário & Eventos (Base Organizacional 04/05) —
 * o calendário corporativo único: feriados, eventos e prazos de documentos.
 */
export function CalendarView() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canManageEvents = user?.role === "admin" || user?.role === "manager";
  const canManageHolidays = user?.role === "admin";
  const { locations } = useLocations();
  const today = new Date().toISOString().slice(0, 10);

  const [mode, setMode] = useState<"month" | "week">("month");
  const [cursor, setCursor] = useState(today);
  const [filter, setFilter] = useState<CalendarFilter>({ kind: "", locationId: "", priority: "" });
  const [dialog, setDialog] = useState<Dialog>({ kind: "none" });

  const range = visibleRange(mode, cursor);
  const { data: items = [], isLoading, isError } = useCalendarItems(range.from, range.to, filter);
  const { data: upcoming = [] } = useUpcomingImportant();
  const byDate = itemsByDate(items);
  const locationName = new Map(locations.map((l) => [l.id, l.name]));
  const month = cursor.slice(0, 7);

  function open(item: CalendarItem) {
    if (item.kind === "deadline") navigate("/empresa/documentos");
    else setDialog({ kind: item.kind, item, date: item.date });
  }

  function move(step: number) {
    setCursor(mode === "month" ? addMonths(cursor, step) : addDays(cursor, step * 7));
  }

  function chip(item: CalendarItem) {
    const where = item.locationId ? ` · ${locationName.get(item.locationId) ?? "Local"}` : "";
    return (
      <button
        key={item.key}
        type="button"
        onClick={() => open(item)}
        title={`${KIND_LABELS[item.kind]}${where}`}
        className={`block w-full truncate rounded border px-1.5 py-0.5 text-left text-[11px] font-medium ${itemClasses(item)}`}
      >
        {itemLabel(item)}
      </button>
    );
  }

  const selectCls = "rounded-md border border-stone-300 bg-white py-1.5 px-2 text-sm text-stone-700 outline-none focus:border-[#ED5C32]";

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 p-4 lg:flex-row">
      <section className="min-w-0 flex-1 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => move(-1)} className="rounded-md border border-stone-200 px-2 py-1 text-sm" aria-label="Anterior">
              ‹
            </button>
            <button type="button" onClick={() => setCursor(today)} className="rounded-md border border-stone-200 px-3 py-1 text-sm">
              Hoje
            </button>
            <button type="button" onClick={() => move(1)} className="rounded-md border border-stone-200 px-2 py-1 text-sm" aria-label="Seguinte">
              ›
            </button>
            <h2 className="ml-2 text-base font-semibold text-stone-900">{monthTitle(cursor)}</h2>
          </div>
          <div className="flex rounded-lg border border-stone-200 p-0.5">
            {(["month", "week"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                aria-pressed={mode === m}
                className={`rounded-md px-3 py-1 text-xs font-medium ${mode === m ? "bg-stone-800 text-white" : "text-stone-600"}`}
              >
                {m === "month" ? "Mês" : "Semana"}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select aria-label="Tipo" value={filter.kind} onChange={(e) => setFilter((f) => ({ ...f, kind: e.target.value as CalendarItemKind | "" }))} className={selectCls}>
            <option value="">Todos</option>
            {Object.entries(KIND_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          {locations.length > 0 && (
            <select aria-label="Local" value={filter.locationId} onChange={(e) => setFilter((f) => ({ ...f, locationId: e.target.value }))} className={selectCls}>
              <option value="">Local: Todos</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          )}
          <select aria-label="Prioridade" value={filter.priority} onChange={(e) => setFilter((f) => ({ ...f, priority: e.target.value as EventPriority | "" }))} className={selectCls}>
            <option value="">Prioridade: Todas</option>
            {Object.entries(PRIORITY_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          <div className="ml-auto flex gap-2">
            {canManageHolidays && (
              <>
                <button type="button" onClick={() => setDialog({ kind: "import" })} className="rounded-lg border border-stone-200 px-3 py-1.5 text-sm font-medium text-stone-700">
                  Importar feriados
                </button>
                <button type="button" onClick={() => setDialog({ kind: "holiday", item: null, date: today })} className="rounded-lg border border-stone-200 px-3 py-1.5 text-sm font-medium text-stone-700">
                  Novo feriado
                </button>
              </>
            )}
            {canManageEvents && (
              <button
                type="button"
                onClick={() => setDialog({ kind: "event", item: null, date: today })}
                className="rounded-lg bg-gradient-to-r from-[#ED5C32] to-[#EF8935] px-3 py-1.5 text-sm font-medium text-white shadow-sm"
              >
                Novo evento
              </button>
            )}
          </div>
        </div>

        {isError && <p className="text-sm text-[#A3211A]">Não foi possível carregar o calendário.</p>}

        <div className={`overflow-hidden rounded-xl border border-stone-200 bg-white ${isLoading ? "opacity-60" : ""}`}>
          <div className="grid grid-cols-7 border-b border-stone-200 bg-stone-50 text-center text-xs font-medium text-stone-500">
            {WEEKDAYS.map((d) => (
              <div key={d} className="py-2">
                {d}
              </div>
            ))}
          </div>
          {(mode === "month" ? monthGrid(cursor) : [weekDays(cursor)]).map((week) => (
            <div key={week[0]} className="grid grid-cols-7 divide-x divide-stone-100 border-b border-stone-100 last:border-b-0">
              {week.map((day) => (
                <div
                  key={day}
                  className={`space-y-1 p-1.5 ${mode === "week" ? "min-h-56" : "min-h-24"} ${mode === "month" && day.slice(0, 7) !== month ? "bg-stone-50/60" : ""}`}
                  data-date={day}
                >
                  <div className={`text-right text-xs ${day === today ? "font-bold text-[#ED5C32]" : "text-stone-500"}`}>{Number(day.slice(8, 10))}</div>
                  {(byDate.get(day) ?? []).map(chip)}
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-3 text-xs text-stone-600">
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-amber-200" /> Feriado</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-sky-200" /> Evento</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-orange-200" /> Importante</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-red-200" /> Crítico</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-violet-200" /> Prazo de documento</span>
        </div>
      </section>

      <aside className="w-full shrink-0 lg:w-72">
        <div className="rounded-xl border border-stone-200 bg-white p-4">
          <h3 className="mb-3 text-sm font-semibold text-stone-800">Próximos eventos importantes</h3>
          {upcoming.length === 0 && <p className="text-sm text-stone-500">Nada nos próximos 60 dias.</p>}
          <ul className="space-y-2">
            {upcoming.map((u) => (
              <li key={u.key}>
                <button type="button" onClick={() => open(u)} className="flex w-full items-start gap-3 text-left">
                  <span className="w-14 shrink-0 text-xs font-bold text-stone-700">{shortDate(u.date)}</span>
                  <span className="min-w-0 flex-1 text-sm">
                    <span className="block truncate text-stone-800">{u.title}</span>
                    <span className="text-xs text-stone-500">
                      {u.kind === "holiday" ? `Feriado${u.locationId ? ` — ${locationName.get(u.locationId) ?? ""}` : ""}` : u.priority ? PRIORITY_LABELS[u.priority] : ""}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      {dialog.kind === "event" && (
        <EventDrawer item={dialog.item} defaultDate={dialog.date} canEdit={canManageEvents} locations={locations} onClose={() => setDialog({ kind: "none" })} />
      )}
      {dialog.kind === "holiday" && (
        <HolidayDrawer item={dialog.item} defaultDate={dialog.date} canEdit={canManageHolidays} locations={locations} onClose={() => setDialog({ kind: "none" })} />
      )}
      {dialog.kind === "import" && <ImportHolidaysModal defaultYear={Number(today.slice(0, 4)) + 1} onClose={() => setDialog({ kind: "none" })} />}
    </div>
  );
}
