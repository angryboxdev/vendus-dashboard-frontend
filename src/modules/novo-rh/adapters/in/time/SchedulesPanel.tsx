import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useI18n } from "../../../../../i18n/I18nProvider.tsx";
import type { MessageKey } from "../../../../../i18n/i18n.ts";
import { AlertBanner, Button, FIELD, IconPlus, SECTION_TITLE, StatusBadge, SURFACE } from "../../../../../components/ui/index.ts";
import type { ScheduleKind, WorkSchedule } from "../../../domain/entities/time.ts";
import { todayIn } from "../../../domain/services/settings-format.service.ts";
import { emptyDraft, formatMinutes, versionDaysFromDraft, WEEKDAYS, weeklyMinutes, dayMinutes, type DayDraft } from "../../../domain/services/time-format.service.ts";
import { useNovoRh } from "../../../novo-rh.module.tsx";
import { AssignmentsBox } from "./AssignmentsBox.tsx";

function DaysEditor({ kind, draft, onChange }: { kind: ScheduleKind; draft: DayDraft; onChange: (d: DayDraft) => void }) {
  const { t } = useI18n();
  return (
    <div className="space-y-1">
      <p className="text-xs text-stone-500">{kind === "fixed" ? t("time.schedule.fixedHint") : t("time.schedule.flexibleHint")}</p>
      <div className="grid gap-1 sm:grid-cols-7">
        {WEEKDAYS.map((d) => (
          <label key={d} className="text-xs text-stone-600">
            {t(`time.weekday.${d}` as MessageKey)}
            <input aria-label={t(`time.weekday.${d}` as MessageKey)} className={`${FIELD} mt-0.5 w-full`} value={draft[d]} onChange={(e) => onChange({ ...draft, [d]: e.target.value })} />
          </label>
        ))}
      </div>
    </div>
  );
}

function ScheduleCard({ s }: { s: WorkSchedule }) {
  const { t } = useI18n();
  const { time } = useNovoRh();
  const qc = useQueryClient();
  const [draft, setDraft] = useState<DayDraft>(emptyDraft());
  const [from, setFrom] = useState(todayIn());
  const days = versionDaysFromDraft(s.kind, draft);
  const latest = s.versions.at(-1);
  const add = useMutation({
    mutationFn: () => time.addVersion(s.id, { validFrom: from, validTo: null, days: days!, night: latest?.night ?? false, halfDayMinutes: latest?.halfDayMinutes ?? null }),
    onSuccess: () => (setDraft(emptyDraft()), void qc.invalidateQueries({ queryKey: ["novo-rh", "time"] })),
  });
  return (
    <section className={`${SURFACE} space-y-3 p-4`} aria-label={s.name}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className={SECTION_TITLE}>{s.name}</h3>
        <StatusBadge tone="neutral">{t(s.kind === "fixed" ? "time.schedule.kind.fixed" : "time.schedule.kind.flexible")}</StatusBadge>
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">{t("time.schedule.versions")}</p>
        <ul className="mt-1 space-y-1 text-sm text-stone-700">
          {s.versions.map((v) => (
            <li key={v.id}>
              {v.validFrom} → {v.validTo ?? "…"} · {t("time.schedule.weekly", { hours: formatMinutes(weeklyMinutes(s.kind, v)) })} ·{" "}
              {WEEKDAYS.filter((d) => dayMinutes(s.kind, v, d) > 0)
                .map((d) => `${t(`time.weekday.${d}` as MessageKey)} ${formatMinutes(dayMinutes(s.kind, v, d))}`)
                .join(", ")}
            </li>
          ))}
        </ul>
      </div>
      <details className="rounded-lg border border-stone-200 p-2">
        <summary className="cursor-pointer text-sm text-stone-700">{t("time.schedule.newVersion")}…</summary>
        <div className="mt-2 space-y-2">
          <input aria-label={t("time.schedule.newVersion")} type="date" className={FIELD} value={from} onChange={(e) => setFrom(e.target.value)} />
          <DaysEditor kind={s.kind} draft={draft} onChange={setDraft} />
          {!days && <p className="text-xs text-red-700">{t("time.schedule.invalid")}</p>}
          <Button size="sm" disabled={!days || add.isPending} onClick={() => add.mutate()}>
            {t("common.save")}
          </Button>
          {add.isError && <p className="text-xs text-red-700">{add.error instanceof Error ? add.error.message : ""}</p>}
        </div>
      </details>
      <AssignmentsBox resourceType="schedule" resourceId={s.id} />
    </section>
  );
}

/** Tempo → Horários: fixos/flexíveis com versões por data e a quem se aplicam. */
export function SchedulesPanel() {
  const { t } = useI18n();
  const { time } = useNovoRh();
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: "", kind: "fixed" as ScheduleKind, night: false, halfDay: "", from: todayIn() });
  const [draft, setDraft] = useState<DayDraft>({ ...emptyDraft(), "1": "09:00-13:00, 14:00-18:00", "2": "09:00-13:00, 14:00-18:00", "3": "09:00-13:00, 14:00-18:00", "4": "09:00-13:00, 14:00-18:00", "5": "09:00-13:00, 14:00-18:00" });
  const list = useQuery({ queryKey: ["novo-rh", "time", "schedules"], queryFn: () => time.listSchedules() });
  const days = versionDaysFromDraft(form.kind, draft);
  const create = useMutation({
    mutationFn: () =>
      time.createSchedule({ name: form.name, kind: form.kind, version: { validFrom: form.from, validTo: null, days: days!, night: form.night, halfDayMinutes: form.halfDay ? Number(form.halfDay) : null } }),
    onSuccess: () => (setForm({ ...form, name: "" }), void qc.invalidateQueries({ queryKey: ["novo-rh", "time"] })),
  });

  return (
    <div className="space-y-4">
      <section className={`${SURFACE} space-y-3 p-4`} aria-labelledby="new-schedule">
        <h2 id="new-schedule" className={SECTION_TITLE}>
          {t("time.schedule.new")}
        </h2>
        <div className="grid gap-2 sm:grid-cols-[1fr_220px_160px_160px]">
          <input aria-label={t("common.name")} placeholder={t("common.name")} className={FIELD} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <select aria-label={t("contracts.type")} className={FIELD} value={form.kind} onChange={(e) => (setForm({ ...form, kind: e.target.value as ScheduleKind }), setDraft(emptyDraft()))}>
            <option value="fixed">{t("time.schedule.kind.fixed")}</option>
            <option value="flexible">{t("time.schedule.kind.flexible")}</option>
          </select>
          <input aria-label={t("time.schedule.validFrom")} type="date" className={FIELD} value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })} />
          <input aria-label={t("time.schedule.halfDay")} placeholder={t("time.schedule.halfDay")} type="number" className={FIELD} value={form.halfDay} onChange={(e) => setForm({ ...form, halfDay: e.target.value })} />
        </div>
        <DaysEditor kind={form.kind} draft={draft} onChange={setDraft} />
        {form.kind === "fixed" && (
          <label className="flex items-center gap-2 text-sm text-stone-700">
            <input type="checkbox" checked={form.night} onChange={(e) => setForm({ ...form, night: e.target.checked })} />
            {t("time.schedule.night")}
          </label>
        )}
        {!days && <p className="text-xs text-red-700">{t("time.schedule.invalid")}</p>}
        {create.isError && (
          <AlertBanner tone="danger" title={t("common.error")}>
            {create.error instanceof Error ? create.error.message : ""}
          </AlertBanner>
        )}
        <div className="flex justify-end">
          <Button variant="primary" icon={<IconPlus />} disabled={!form.name.trim() || !days || create.isPending} onClick={() => create.mutate()}>
            {t("common.add")}
          </Button>
        </div>
      </section>
      {(list.data ?? []).filter((s) => !s.archived).length === 0 ? (
        <p className="text-sm text-stone-500">{t("time.schedule.empty")}</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {list.data!.filter((s) => !s.archived).map((s) => (
            <ScheduleCard key={s.id} s={s} />
          ))}
        </div>
      )}
    </div>
  );
}
