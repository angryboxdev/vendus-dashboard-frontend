import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useI18n } from "../../../../../i18n/I18nProvider.tsx";
import type { MessageKey } from "../../../../../i18n/i18n.ts";
import { Drawer, SECTION_TITLE, StatusBadge, TABLE, TD, TH, THEAD, TR } from "../../../../../components/ui/index.ts";
import type { PersonOverview } from "../../../domain/entities/overview.ts";
import { dateIn, formatDuration, timeIn } from "../../../domain/services/attendance.service.ts";
import { useNovoRh } from "../../../novo-rh.module.tsx";
import { STATUS } from "./overview-status.ts";

const day = (date: string) => new Intl.DateTimeFormat("pt-PT", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));

/** Detalhe de uma pessoa no painel: o dia (horário vs. marcações) e os últimos 7 dias. */
export function PersonDayDrawer({ person, date, timeZone, onClose }: { person: PersonOverview; date: string; timeZone: string; onClose: () => void }) {
  const { t } = useI18n();
  const { attendance } = useNovoRh();
  const punches = useQuery({ queryKey: ["novo-rh", "overview", "punches", person.employeeId, date], queryFn: () => attendance.days(person.employeeId, date, date) });
  const events = (punches.data?.events ?? []).filter((e) => dateIn(e.occurredAt, punches.data!.timeZone) === date);
  const s = STATUS[person.status];
  const balance = person.workedSeconds - person.theoreticalSeconds;

  return (
    <Drawer
      open
      title={person.name}
      description={person.locationName ?? t("ovw.noLocation")}
      onClose={onClose}
      width="max-w-xl"
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <Link to={`/hr/novo/pessoas/${person.employeeId}`} className="rounded-md border border-[#F5C992] px-3 py-1.5 text-sm text-stone-700 hover:bg-[#FDF8F5]">
            {t("ovw.drawer.openPerson")}
          </Link>
          <Link to={`/hr/novo/assiduidade?employeeId=${person.employeeId}`} className="rounded-md bg-gradient-to-r from-[#ED5C32] to-[#F08A4B] px-3 py-1.5 text-sm font-medium text-white">
            {t("ovw.drawer.openAttendance")}
          </Link>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge tone={s.tone}>{t(s.key)}</StatusBadge>
          {person.lateMinutes > 0 && <StatusBadge tone="warning">{t("ovw.lateBy", { minutes: person.lateMinutes })}</StatusBadge>}
          {person.absenceType && <span className="text-sm text-stone-600">{person.absenceType}</span>}
        </div>

        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-xs text-stone-500">{t("ovw.col.planned")}</dt>
            <dd className="font-medium text-stone-900">{person.plannedStart ? `${person.plannedStart}–${person.plannedEnd ?? "?"}` : t("ovw.drawer.noSchedule")}</dd>
          </div>
          <div>
            <dt className="text-xs text-stone-500">{t("ovw.col.firstIn")}</dt>
            <dd className="font-medium text-stone-900">{person.firstInAt ? timeIn(person.firstInAt, timeZone) : "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-stone-500">{t("ovw.drawer.worked")}</dt>
            <dd className="font-medium text-stone-900">
              {formatDuration(person.workedSeconds)} / {formatDuration(person.theoreticalSeconds)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-stone-500">{t("ovw.drawer.balance")}</dt>
            <dd className={`font-medium ${balance < 0 ? "text-red-700" : "text-emerald-700"}`}>{formatDuration(balance)}</dd>
          </div>
        </dl>

        <section>
          <h4 className={SECTION_TITLE}>{t("ovw.drawer.punches")}</h4>
          {punches.isLoading && <p className="mt-1 text-sm text-stone-400">{t("common.loading")}</p>}
          {punches.isError && <p className="mt-1 text-sm text-red-700">{punches.error.message}</p>}
          {punches.data && events.length === 0 && <p className="mt-1 text-sm text-stone-500">{t("ovw.drawer.noPunches")}</p>}
          {events.length > 0 && (
            <ol className="mt-2 space-y-1 text-sm">
              {events.map((e) => (
                <li key={e.id} className="flex gap-3">
                  <span className="w-12 font-mono text-stone-900">{timeIn(e.occurredAt, punches.data!.timeZone)}</span>
                  <span className="text-stone-600">{t(`att.segment.${e.segmentType}` as MessageKey)}</span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section>
          <h4 className={SECTION_TITLE}>{t("ovw.drawer.week")}</h4>
          <table className={`${TABLE} mt-2`}>
            <thead className={THEAD}>
              <tr>
                <th className={TH}>{t("ovw.drawer.day")}</th>
                <th className={TH}>{t("ovw.col.status")}</th>
                <th className={TH}>{t("ovw.col.firstIn")}</th>
                <th className={TH}>{t("ovw.col.worked")}</th>
              </tr>
            </thead>
            <tbody>
              {[...person.week].reverse().map((d) => (
                <tr key={d.date} className={TR}>
                  <td className={`${TD} capitalize`}>{day(d.date)}</td>
                  <td className={TD}>
                    <div className="flex flex-wrap gap-1">
                      <StatusBadge tone={STATUS[d.status].tone}>{t(STATUS[d.status].key)}</StatusBadge>
                      {d.lateMinutes > 0 && <StatusBadge tone="warning">{t("ovw.lateBy", { minutes: d.lateMinutes })}</StatusBadge>}
                    </div>
                  </td>
                  <td className={TD}>{d.firstInAt ? timeIn(d.firstInAt, timeZone) : "—"}</td>
                  <td className={TD}>{d.theoreticalSeconds > 0 || d.workedSeconds > 0 ? `${formatDuration(d.workedSeconds)} / ${formatDuration(d.theoreticalSeconds)}` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </Drawer>
  );
}
