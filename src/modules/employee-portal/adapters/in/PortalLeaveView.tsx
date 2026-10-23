import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { dateLabel, LEAVE_TYPE_LABELS } from "../../domain/services/portal-text.service.ts";
import { FOCUS_RING, IconChevronLeft, IconChevronRight } from "../../../../components/ui";
import { useEmployeePortalModule } from "../../employee-portal.module.tsx";
import { todayLisbon } from "./portal-today.ts";
import { PortalRequestsSection } from "./PortalRequestsSection.tsx";

const NAV = `inline-flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-surface-card text-navy-900 ${FOCUS_RING}`;

/** Pedidos (ticket 12) + ausências do próprio (ticket 09, só consulta, sem saldo de férias nem feriados). */
export function PortalLeaveView() {
  const { selfService } = useEmployeePortalModule();
  const [year, setYear] = useState(() => Number(todayLisbon().slice(0, 4)));
  const { data, isLoading, isError } = useQuery({ queryKey: ["portal-leave", year], queryFn: () => selfService.getLeave(year), retry: false });

  return (
    <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
      <PortalRequestsSection />
      <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => setYear(year - 1)} className={NAV} aria-label="Ano anterior">
          <IconChevronLeft size={20} />
        </button>
        <h1 className="text-base font-semibold text-navy-900">Ausências {year}</h1>
        <button type="button" onClick={() => setYear(year + 1)} className={NAV} aria-label="Ano seguinte">
          <IconChevronRight size={20} />
        </button>
      </div>

      {isLoading ? (
        <p className="text-sm text-ink-secondary">A carregar…</p>
      ) : isError || !data ? (
        <p className="text-sm text-red-700">Não foi possível carregar as ausências.</p>
      ) : data.entries.length === 0 ? (
        <section className="rounded-2xl border border-line bg-surface-card p-5 text-center text-sm text-ink-secondary shadow-card">Sem ausências registadas em {year}.</section>
      ) : (
        <ul className="divide-y divide-line-subtle rounded-2xl border border-line bg-surface-card shadow-card">
          {[...data.entries]
            .sort((a, b) => b.startDate.localeCompare(a.startDate))
            .map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-navy-900">{LEAVE_TYPE_LABELS[e.type] ?? e.type}</p>
                  <p className="text-xs text-ink-secondary">
                    {e.startDate === e.endDate ? dateLabel(e.startDate) : `${dateLabel(e.startDate)} – ${dateLabel(e.endDate)}`}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-ink-secondary">
                  {e.workingDays} {e.workingDays === 1 ? "dia útil" : "dias úteis"}
                </span>
              </li>
            ))}
        </ul>
      )}
      </div>
    </div>
  );
}
