import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useI18n } from "../../../../../i18n/I18nProvider.tsx";
import { Avatar, Button, FIELD, StatusBadge, SURFACE, TABLE, TD, TH, THEAD, TR } from "../../../../../components/ui/index.ts";
import type { PersonOverview } from "../../../domain/entities/overview.ts";
import { formatDuration } from "../../../domain/services/attendance.service.ts";
import { DayTimeline, TimelineLegend } from "./DayTimeline.tsx";
import { useNovoRh } from "../../../novo-rh.module.tsx";
import { STATUS } from "../overview/overview-status.ts";
import { PersonDayDrawer } from "../overview/PersonDayDrawer.tsx";
import { useEmployeePhotos } from "../common/use-employee-photos.ts";


/**
 * Assiduidade → Dia da equipa (FE-030): de uma vez, o planeado e o que cada
 * pessoa marcou nesse dia (linha 0–24 h), com atrasos e faltas. Mesma fonte
 * do Painel; o detalhe e a correção ficam no painel lateral e em "Dias".
 */
export function TeamDayPanel() {
  const { t } = useI18n();
  const photoOf = useEmployeePhotos();
  const { overview } = useNovoRh();
  const [date, setDate] = useState<string | null>(null);
  const [onlyIssues, setOnlyIssues] = useState(false);
  const [open, setOpen] = useState<PersonOverview | null>(null);
  const q = useQuery({ queryKey: ["novo-rh", "overview", date ?? "today"], queryFn: () => overview.get(date ?? undefined) });
  const o = q.data;
  const people = useMemo(() => (o?.people ?? []).filter((p) => p.theoreticalSeconds > 0 || p.workedSeconds > 0).filter((p) => !onlyIssues || p.status === "missing" || p.lateMinutes > 0), [o, onlyIssues]);

  if (q.isError) return <p className="text-sm text-red-700">{q.error.message}</p>;
  if (!o) return <p className="text-sm text-stone-400">{t("common.loading")}</p>;

  return (
    <section className={`${SURFACE} space-y-3 p-4`} aria-label={t("att.tab.team")}>
      <div className="flex flex-wrap items-center gap-2">
        <input type="date" aria-label={t("ovw.date")} className={FIELD} value={o.date} max={o.today} onChange={(e) => setDate(e.target.value && e.target.value !== o.today ? e.target.value : null)} />
        {o.date !== o.today && (
          <Button size="sm" onClick={() => setDate(null)}>
            {t("ovw.today")}
          </Button>
        )}
        <label className="flex items-center gap-2 text-sm text-stone-700">
          <input type="checkbox" checked={onlyIssues} onChange={(e) => setOnlyIssues(e.target.checked)} />
          {t("att.team.onlyIssues")}
        </label>
        <span className="ml-auto text-xs text-stone-500">{t("att.team.summary", { missing: o.kpis.missing, late: o.kpis.late, present: o.kpis.working + o.kpis.remote + o.kpis.onBreak })}</span>
      </div>

      <div className="overflow-x-auto">
        <table className={TABLE}>
          <thead className={THEAD}>
            <tr>
              <th className={TH}>{t("ovw.col.person")}</th>
              <th className={TH}>{t("ovw.col.status")}</th>
              <th className={`${TH} min-w-[320px]`}>
                <div className="flex justify-between font-normal normal-case text-stone-400">
                  {[0, 6, 12, 18, 24].map((h) => (
                    <span key={h}>{String(h).padStart(2, "0")}h</span>
                  ))}
                </div>
              </th>
              <th className={TH}>{t("ovw.col.worked")}</th>
            </tr>
          </thead>
          <tbody>
            {people.map((p) => (
              <tr key={p.employeeId} className={`${TR} hover:bg-[#FDF8F5]`}>
                <td className={TD}>
                  <div className="flex items-center gap-2.5">
                    <Avatar name={p.name} photoUrl={photoOf(p.employeeId)} size="sm" />
                    <div className="min-w-0">
                      <button type="button" className="text-left font-medium text-stone-900 hover:underline" onClick={() => setOpen(p)}>
                        {p.name}
                      </button>
                      <span className="block text-xs text-stone-500">{p.locationName ?? t("ovw.noLocation")}</span>
                    </div>
                  </div>
                </td>
                <td className={TD}>
                  <div className="flex flex-wrap gap-1">
                    <StatusBadge tone={STATUS[p.status].tone}>{t(STATUS[p.status].key)}</StatusBadge>
                    {p.lateMinutes > 0 && <StatusBadge tone="warning">{t("ovw.lateBy", { minutes: p.lateMinutes })}</StatusBadge>}
                  </div>
                </td>
                <td className={TD}>
                  <DayTimeline segments={p.segments} date={o.date} timeZone={o.timeZone} planned={p.plannedStart ? { start: p.plannedStart, end: p.plannedEnd } : null} label={t("att.team.timeline", { name: p.name })} />
                </td>
                <td className={TD}>{`${formatDuration(p.workedSeconds)} / ${formatDuration(p.theoreticalSeconds)}`}</td>
              </tr>
            ))}
            {people.length === 0 && (
              <tr>
                <td className={`${TD} text-center text-stone-500`} colSpan={4}>
                  {t("ovw.people.empty")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <TimelineLegend withPlanned />
      {open && <PersonDayDrawer person={open} date={o.date} timeZone={o.timeZone} onClose={() => setOpen(null)} />}
    </section>
  );
}
