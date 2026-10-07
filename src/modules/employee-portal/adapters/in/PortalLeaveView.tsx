import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { dateLabel, LEAVE_TYPE_LABELS } from "../../domain/services/portal-text.service.ts";
import { useEmployeePortalModule } from "../../employee-portal.module.tsx";
import { todayLisbon } from "./portal-today.ts";

/** Ausências do próprio (ticket 09) — só consulta, sem saldo de férias nem feriados. */
export function PortalLeaveView() {
  const { selfService } = useEmployeePortalModule();
  const [year, setYear] = useState(() => Number(todayLisbon().slice(0, 4)));
  const { data, isLoading, isError } = useQuery({ queryKey: ["portal-leave", year], queryFn: () => selfService.getLeave(year), retry: false });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => setYear(year - 1)} className="rounded-lg px-3 py-2 text-sm text-stone-600" aria-label="Ano anterior">
          ‹
        </button>
        <h1 className="text-base font-semibold text-stone-900">Ausências {year}</h1>
        <button type="button" onClick={() => setYear(year + 1)} className="rounded-lg px-3 py-2 text-sm text-stone-600" aria-label="Ano seguinte">
          ›
        </button>
      </div>

      {isLoading ? (
        <p className="text-sm text-stone-500">A carregar…</p>
      ) : isError || !data ? (
        <p className="text-sm text-red-700">Não foi possível carregar as ausências.</p>
      ) : data.entries.length === 0 ? (
        <section className="rounded-2xl border border-[#F5C992]/50 bg-white p-5 text-center text-sm text-stone-600 shadow-sm">Sem ausências registadas em {year}.</section>
      ) : (
        <ul className="divide-y divide-stone-100 rounded-2xl border border-[#F5C992]/50 bg-white shadow-sm">
          {[...data.entries]
            .sort((a, b) => b.startDate.localeCompare(a.startDate))
            .map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-stone-900">{LEAVE_TYPE_LABELS[e.type] ?? e.type}</p>
                  <p className="text-xs text-stone-500">
                    {e.startDate === e.endDate ? dateLabel(e.startDate) : `${dateLabel(e.startDate)} – ${dateLabel(e.endDate)}`}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-stone-500">
                  {e.workingDays} {e.workingDays === 1 ? "dia útil" : "dias úteis"}
                </span>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
