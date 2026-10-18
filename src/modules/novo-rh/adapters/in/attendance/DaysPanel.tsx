import { Fragment, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useI18n } from "../../../../../i18n/I18nProvider.tsx";
import type { MessageKey } from "../../../../../i18n/i18n.ts";
import { Button, FIELD, IconPlus, SECTION_TITLE, StatusBadge, SURFACE, TABLE, TD, TH, THEAD, TR } from "../../../../../components/ui/index.ts";
import type { AttendanceDays } from "../../../domain/entities/attendance.ts";
import { dateIn, formatDuration, timeIn, weekOf } from "../../../domain/services/attendance.service.ts";
import { todayIn } from "../../../domain/services/settings-format.service.ts";
import { useNovoRh } from "../../../novo-rh.module.tsx";
import { ReviseDrawer, type ReviseTarget } from "./ReviseDrawer.tsx";
import { DayTimeline, TimelineLegend } from "./DayTimeline.tsx";

/** Dias de um colaborador: totais do motor, marcações, correções e ajustes (TK-13). */
export function DaysPanel({ fixedEmployeeId }: { fixedEmployeeId?: string } = {}) {
  const { t } = useI18n();
  const { attendance, settings } = useNovoRh();
  // Vindo do Painel: /hr/novo/assiduidade?employeeId=… abre já essa pessoa.
  const [employeeId, setEmployeeId] = useState(() => fixedEmployeeId ?? new URLSearchParams(window.location.search).get("employeeId") ?? "");
  const [range, setRange] = useState(() => weekOf(todayIn()));
  const [open, setOpen] = useState<string | null>(null);
  const [revise, setRevise] = useState<ReviseTarget | null>(null);
  const employees = useQuery({ queryKey: ["novo-rh", "settings", "employees"], queryFn: () => settings.listEmployees() });
  const q = useQuery({ queryKey: ["novo-rh", "attendance", "days", employeeId, range], queryFn: () => attendance.days(employeeId, range.from, range.to), enabled: !!employeeId });
  const adjustments = useQuery({ queryKey: ["novo-rh", "attendance", "adjustments", employeeId, range], queryFn: () => attendance.adjustments(employeeId, range.from, range.to), enabled: !!employeeId });
  const recalc = useMutation({ mutationFn: () => attendance.recalculate(employeeId, range.from, range.to) });

  return (
    <section className={`${SURFACE} space-y-3 p-4`}>
      <p className="text-xs text-stone-500">{t("att.days.hint")}</p>
      <div className="flex flex-wrap items-center gap-2">
        {!fixedEmployeeId && (
          <select aria-label={t("common.employee")} className={`${FIELD} min-w-[220px]`} value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
            <option value="">{t("common.employee")}…</option>
            {(employees.data ?? []).map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        )}
        <input aria-label={t("common.from")} type="date" className={FIELD} value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} />
        <input aria-label={t("common.to")} type="date" className={FIELD} value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} />
        {employeeId && (
          <Button size="sm" disabled={recalc.isPending} onClick={() => recalc.mutate()}>
            {t("att.recalculate")}
          </Button>
        )}
        {recalc.data && <span className="text-xs text-stone-500">{t("att.recalculate.done", { count: recalc.data.queued })}</span>}
      </div>
      {q.isError && <p className="text-sm text-red-700">{q.error instanceof Error ? q.error.message : t("common.loadError")}</p>}
      {q.data && (
        <>
          <p className="text-sm font-semibold text-stone-900">
            {t("att.totals", {
              worked: formatDuration(q.data.totals.workedSeconds),
              theoretical: formatDuration(q.data.totals.theoreticalSeconds),
              excess: formatDuration(q.data.totals.excessSeconds),
              pending: formatDuration(q.data.totals.pendingSeconds),
            })}
          </p>
          {q.data.days.some((d) => d.segments.length > 0) && <TimelineLegend />}
          <div className="overflow-auto">
            <table className={TABLE}>
              <thead className={THEAD}>
                <tr>
                  <th className={TH}>{t("common.date")}</th>
                  <th className={`${TH} min-w-[180px]`}>{t("att.col.timeline")}</th>
                  <th className={TH}>{t("att.col.worked")}</th>
                  <th className={TH}>{t("att.col.theoretical")}</th>
                  <th className={TH}>{t("att.col.excess")}</th>
                  <th className={TH}>{t("att.col.pending")}</th>
                  <th className={TH}>{t("att.col.incidents")}</th>
                </tr>
              </thead>
              <tbody>
                {q.data.days.map((d) => (
                  <Fragment key={d.workDate}>
                    <tr className={`${TR} cursor-pointer`} onClick={() => setOpen(open === d.workDate ? null : d.workDate)} aria-expanded={open === d.workDate}>
                      <td className={TD}>
                        <button type="button" className="font-medium text-stone-900 underline-offset-2 hover:underline">
                          {d.workDate}
                        </button>
                      </td>
                      <td className={TD}>{d.segments.length > 0 ? <DayTimeline size="sm" segments={d.segments} date={d.workDate} timeZone={q.data.timeZone} label={t("att.timeline.dayLabel", { date: d.workDate })} /> : <span className="text-stone-400">—</span>}</td>
                      <td className={`${TD} font-semibold`}>{formatDuration(d.workedSeconds)}</td>
                      <td className={TD}>{formatDuration(d.theoreticalSeconds)}</td>
                      <td className={TD}>{formatDuration(d.excessSeconds)}</td>
                      <td className={TD}>{d.pendingSeconds > 0 ? formatDuration(d.pendingSeconds) : "—"}</td>
                      <td className={TD}>
                        <span className="flex flex-wrap gap-1">
                          {d.incidents.map((i) => (
                            <StatusBadge key={i} tone={i === "late" ? "warning" : "danger"}>
                              {t(`att.incident.${i}` as MessageKey)}
                            </StatusBadge>
                          ))}
                        </span>
                      </td>
                    </tr>
                    {open === d.workDate && (
                      <tr>
                        <td colSpan={7} className="bg-stone-50/60 px-3 py-3">
                          <DayDetail data={q.data} date={d.workDate} onRevise={setRevise} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
          {(adjustments.data ?? []).length > 0 && (
            <div className="space-y-1">
              <h3 className={SECTION_TITLE}>{t("att.adjustments.title")}</h3>
              <ul className="text-sm text-stone-700">
                {adjustments.data!.map((a) => (
                  <li key={a.id}>{t("att.adjustment.row", { date: a.workDate, from: a.fromVersion, to: a.toVersion, delta: formatDuration(a.deltaExcessSeconds), reason: a.reason })}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
      {revise && q.data && <ReviseDrawer key={`${revise.operation}-${revise.event?.id ?? revise.date}`} employeeId={employeeId} timeZone={q.data.timeZone} target={revise} onClose={() => setRevise(null)} />}
    </section>
  );
}

function DayDetail({ data, date, onRevise }: { data: AttendanceDays; date: string; onRevise: (t: ReviseTarget) => void }) {
  const { t } = useI18n();
  const tz = data.timeZone;
  const events = data.events.filter((e) => dateIn(e.occurredAt, tz) === date);
  const revisions = data.revisions.filter((r) => dateIn(r.anchorAt, tz) === date);
  const voided = new Set(revisions.filter((r) => r.state === "active" && r.operation === "void").map((r) => r.targetEventId));
  const changed = new Set(revisions.filter((r) => r.state === "active" && r.operation === "update").map((r) => r.targetEventId));
  const segments = data.days.find((d) => d.workDate === date)?.segments ?? [];
  return (
    <div className="space-y-3">
      {segments.length > 0 && (
        <div className="space-y-1">
          <DayTimeline segments={segments} date={date} timeZone={tz} label={t("att.timeline.dayLabel", { date })} />
          <div className="flex justify-between text-[10px] text-stone-400" aria-hidden="true">
            {[0, 6, 12, 18, 24].map((h) => (
              <span key={h}>{String(h).padStart(2, "0")}h</span>
            ))}
          </div>
        </div>
      )}
      <div className="flex items-center justify-between">
        <h3 className={SECTION_TITLE}>{t("att.events.title", { date })}</h3>
        <Button size="sm" icon={<IconPlus />} onClick={() => onRevise({ operation: "add", event: null, date })}>
          {t("att.revise.add")}
        </Button>
      </div>
      {events.length === 0 && <p className="text-sm text-stone-500">{t("att.events.none")}</p>}
      <ul className="space-y-1">
        {events.map((e) => (
          <li key={e.id} className="flex flex-wrap items-center gap-2 text-sm">
            <span className={`font-mono ${voided.has(e.id) ? "text-stone-400 line-through" : "text-stone-900"}`}>{timeIn(e.occurredAt, tz)}</span>
            <span>{t(`att.segment.${e.segmentType}` as MessageKey)}</span>
            {changed.has(e.id) && <StatusBadge tone="neutral">{t("att.events.revised")}</StatusBadge>}
            {!voided.has(e.id) && (
              <>
                <Button size="sm" variant="tertiary" aria-label={`${t("att.revise.update")} ${timeIn(e.occurredAt, tz)}`} onClick={() => onRevise({ operation: "update", event: e, date })}>
                  {t("att.revise.update")}
                </Button>
                <Button size="sm" variant="tertiary" aria-label={`${t("att.revise.void")} ${timeIn(e.occurredAt, tz)}`} onClick={() => onRevise({ operation: "void", event: e, date })}>
                  {t("att.revise.void")}
                </Button>
              </>
            )}
          </li>
        ))}
      </ul>
      {revisions.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-stone-500">{t("att.revisions.title")}</h4>
          <ul className="space-y-1 text-sm text-stone-700">
            {revisions.map((r) => (
              <li key={r.id}>
                {t(`att.revise.${r.operation}` as MessageKey)}
                {r.occurredAt && ` ${timeIn(r.occurredAt, tz)}`}
                {r.segmentType && ` · ${t(`att.segment.${r.segmentType}` as MessageKey)}`} — {r.author}: {r.reason}
                {r.state === "refused" && (
                  <>
                    {" "}
                    <StatusBadge tone="warning">{t("att.revision.refused")}</StatusBadge>
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
