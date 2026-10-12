import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useI18n } from "../../../../../i18n/I18nProvider.tsx";
import { Button, FIELD, IconChevronLeft, IconChevronRight, StatusBadge, SURFACE } from "../../../../../components/ui/index.ts";
import type { PlanCell } from "../../../domain/entities/overview.ts";
import { formatDuration } from "../../../domain/services/attendance.service.ts";
import { todayIn } from "../../../domain/services/settings-format.service.ts";
import { useNovoRh } from "../../../novo-rh.module.tsx";

const plusDays = (date: string, n: number) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
/** Segunda-feira da semana da data. */
const monday = (date: string) => plusDays(date, -((new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7));
const head = (date: string) => new Intl.DateTimeFormat("pt-PT", { weekday: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));

function Cell({ c }: { c: PlanCell }) {
  const { t } = useI18n();
  if (c.absenceType) return <span className="block truncate rounded bg-sky-50 px-1 py-0.5 text-[11px] text-sky-800" title={c.absenceType}>{c.absenceType}</span>;
  if (c.holiday) return <span className="block rounded bg-violet-50 px-1 py-0.5 text-[11px] text-violet-800">{t("time.plan.holiday")}</span>;
  if (c.theoreticalSeconds <= 0) return <span className="text-[11px] text-stone-400">{t("time.plan.off")}</span>;
  return (
    <span className="block text-[11px] leading-tight text-stone-800">
      {c.plannedStart ? `${c.plannedStart}–${c.plannedEnd ?? "?"}` : t("time.plan.flexible")}
      <span className="block text-stone-500">{formatDuration(c.theoreticalSeconds)}</span>
    </span>
  );
}

/**
 * Tempo → Planeado da equipa (FE-031): horário, feriado e ausência de cada
 * pessoa em 1 ou 2 semanas. Quem não tem nada planeado aparece primeiro.
 */
export function TeamPlanPanel() {
  const { t } = useI18n();
  const { overview } = useNovoRh();
  const [from, setFrom] = useState(() => monday(todayIn()));
  const [weeks, setWeeks] = useState<1 | 2>(2);
  const [location, setLocation] = useState("");
  const to = plusDays(from, weeks * 7 - 1);
  const q = useQuery({ queryKey: ["novo-rh", "overview", "plan", from, to], queryFn: () => overview.plan(from, to) });
  const dates = Array.from({ length: weeks * 7 }, (_, i) => plusDays(from, i));
  const locations = useMemo(() => [...new Map((q.data?.people ?? []).filter((p) => p.locationId).map((p) => [p.locationId!, p.locationName ?? ""])).entries()], [q.data]);
  const people = (q.data?.people ?? []).filter((p) => !location || p.locationId === location);
  const unplanned = people.filter((p) => p.unplanned).length;

  return (
    <section className={`${SURFACE} space-y-3 p-4`} aria-label={t("time.tab.teamPlan")}>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => setFrom(plusDays(from, -7))} aria-label={t("time.plan.prev")} icon={<IconChevronLeft size={14} />} />
        <input type="date" aria-label={t("common.from")} className={FIELD} value={from} onChange={(e) => e.target.value && setFrom(monday(e.target.value))} />
        <Button size="sm" onClick={() => setFrom(plusDays(from, 7))} aria-label={t("time.plan.next")} icon={<IconChevronRight size={14} />} />
        <select aria-label={t("time.plan.weeks")} className={FIELD} value={weeks} onChange={(e) => setWeeks(Number(e.target.value) as 1 | 2)}>
          <option value={1}>{t("time.plan.oneWeek")}</option>
          <option value={2}>{t("time.plan.twoWeeks")}</option>
        </select>
        <select aria-label={t("ovw.location")} className={FIELD} value={location} onChange={(e) => setLocation(e.target.value)}>
          <option value="">{t("ovw.allLocations")}</option>
          {locations.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
        {unplanned > 0 && <StatusBadge tone="warning">{t("time.plan.unplannedCount", { count: unplanned })}</StatusBadge>}
      </div>
      {q.isError && <p className="text-sm text-red-700">{q.error.message}</p>}
      {q.isLoading && <p className="text-sm text-stone-400">{t("common.loading")}</p>}
      {q.data && (
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 bg-white px-2 py-1 text-left text-xs font-semibold text-stone-600">{t("ovw.col.person")}</th>
                {dates.map((d) => (
                  <th key={d} className={`px-1 py-1 text-center text-[11px] font-medium capitalize ${[0, 6].includes(new Date(`${d}T00:00:00Z`).getUTCDay()) ? "text-stone-400" : "text-stone-600"}`}>
                    {head(d)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {people.map((p) => (
                <tr key={p.employeeId} className="border-t border-stone-100">
                  <td className="sticky left-0 bg-white px-2 py-1.5">
                    <span className="font-medium text-stone-900">{p.name}</span>
                    <span className="block text-xs text-stone-500">{p.locationName ?? t("ovw.noLocation")}</span>
                    {p.unplanned && <StatusBadge tone="warning">{t("time.plan.unplanned")}</StatusBadge>}
                  </td>
                  {dates.map((d) => {
                    const c = p.days.find((x) => x.date === d);
                    return (
                      <td key={d} className="min-w-[72px] px-1 py-1.5 align-top">
                        {c ? <Cell c={c} /> : null}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
