import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useI18n } from "../../../../../i18n/I18nProvider.tsx";
import { AlertBanner, Button, FIELD, IconPlus, LABEL, SECTION_TITLE, StatusBadge, SURFACE } from "../../../../../components/ui/index.ts";
import type { VacationCalendar } from "../../../domain/entities/time.ts";
import { useNovoRh } from "../../../novo-rh.module.tsx";
import { AssignmentsBox } from "./AssignmentsBox.tsx";
import { DeleteCalendar } from "./DeleteCalendar.tsx";

type Draft = Omit<VacationCalendar, "id">;
const BLANK: Draft = {
  name: "",
  unit: "days",
  counting: "working",
  limited: true,
  maxAmount: null,
  renewal: "calendar_year",
  renewalStart: null,
  seniorityRules: [],
  cumulative: false,
  halfDay: true,
  allowNegative: false,
  minConsecutive: null,
  maxConsecutive: null,
  advanceMonths: null,
  blockedDates: [],
};

/** Tempo → Férias: configuração dos calendários (os saldos chegam na Fase 5). Sem limite por omissão (D6). */
export function VacationPanel() {
  const { t } = useI18n();
  const { time } = useNovoRh();
  const qc = useQueryClient();
  const [d, setD] = useState<Draft>(BLANK);
  const list = useQuery({ queryKey: ["novo-rh", "time", "vacation"], queryFn: () => time.listVacationCalendars() });
  const create = useMutation({ mutationFn: () => time.createVacationCalendar(d), onSuccess: () => (setD(BLANK), void qc.invalidateQueries({ queryKey: ["novo-rh", "time"] })) });
  const check = (key: "halfDay" | "allowNegative" | "cumulative", label: string) => (
    <label className="flex items-center gap-2 text-sm text-stone-700">
      <input type="checkbox" checked={d[key]} onChange={(e) => setD({ ...d, [key]: e.target.checked })} />
      {label}
    </label>
  );

  return (
    <div className="space-y-4">
      <p className="text-xs text-stone-500">{t("time.vacation.balancesLater")}</p>
      <section className={`${SURFACE} space-y-3 p-4`} aria-labelledby="new-vac">
        <h2 id="new-vac" className={SECTION_TITLE}>
          {t("time.vacation.new")}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="vac-name" className={LABEL}>
              {t("common.name")}
            </label>
            <input id="vac-name" className={`${FIELD} w-full`} value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} />
          </div>
          <div>
            <label htmlFor="vac-max" className={LABEL}>
              {t("time.vacation.max")}
            </label>
            <input id="vac-max" type="number" min={0} className={`${FIELD} w-full`} value={d.maxAmount ?? ""} onChange={(e) => setD({ ...d, maxAmount: e.target.value === "" ? null : Number(e.target.value) })} />
          </div>
          <div>
            <label htmlFor="vac-unit" className={LABEL}>
              {t("time.vacation.unit")}
            </label>
            <select id="vac-unit" className={`${FIELD} w-full`} value={d.unit} onChange={(e) => setD({ ...d, unit: e.target.value as Draft["unit"] })}>
              <option value="days">{t("time.vacation.unit.days")}</option>
              <option value="hours">{t("time.vacation.unit.hours")}</option>
            </select>
          </div>
          <div>
            <label htmlFor="vac-count" className={LABEL}>
              {t("time.vacation.counting")}
            </label>
            <select id="vac-count" className={`${FIELD} w-full`} value={d.counting} onChange={(e) => setD({ ...d, counting: e.target.value as Draft["counting"] })}>
              <option value="working">{t("time.vacation.counting.working")}</option>
              <option value="calendar">{t("time.vacation.counting.calendar")}</option>
            </select>
          </div>
          <div>
            <label htmlFor="vac-renew" className={LABEL}>
              {t("time.vacation.renewal")}
            </label>
            <select id="vac-renew" className={`${FIELD} w-full`} value={d.renewal} onChange={(e) => setD({ ...d, renewal: e.target.value as Draft["renewal"] })}>
              <option value="calendar_year">{t("time.vacation.renewal.calendar_year")}</option>
              <option value="work_year">{t("time.vacation.renewal.work_year")}</option>
              <option value="custom">{t("time.vacation.renewal.custom")}</option>
            </select>
          </div>
          {d.renewal === "custom" && (
            <div>
              <label htmlFor="vac-start" className={LABEL}>
                MM-DD
              </label>
              <input id="vac-start" className={`${FIELD} w-full`} placeholder="04-01" value={d.renewalStart ?? ""} onChange={(e) => setD({ ...d, renewalStart: e.target.value || null })} />
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-4">
          {check("halfDay", t("time.vacation.halfDay"))}
          {check("allowNegative", t("time.vacation.negative"))}
          {check("cumulative", t("time.vacation.cumulative"))}
        </div>
        {create.isError && (
          <AlertBanner tone="danger" title={t("common.error")}>
            {create.error instanceof Error ? create.error.message : ""}
          </AlertBanner>
        )}
        <div className="flex justify-end">
          <Button variant="primary" icon={<IconPlus />} disabled={!d.name.trim() || create.isPending} onClick={() => create.mutate()}>
            {t("common.add")}
          </Button>
        </div>
      </section>
      {(list.data ?? []).length === 0 ? (
        <p className="text-sm text-stone-500">{t("time.vacation.empty")}</p>
      ) : (
        list.data!.map((c) => (
          <section key={c.id} className={`${SURFACE} space-y-3 p-4`} aria-label={c.name}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className={SECTION_TITLE}>{c.name}</h3>
              {c.maxAmount === null ? <StatusBadge tone="warning">{t("time.vacation.noLimit")}</StatusBadge> : <StatusBadge tone="neutral">{`${c.maxAmount} ${t(c.unit === "days" ? "time.vacation.unit.days" : "time.vacation.unit.hours")}`}</StatusBadge>}
            </div>
            <p className="text-sm text-stone-600">
              {t(c.counting === "working" ? "time.vacation.counting.working" : "time.vacation.counting.calendar")} · {t(`time.vacation.renewal.${c.renewal}`)}
            </p>
            <AssignmentsBox resourceType="vacation_calendar" resourceId={c.id} />
            <DeleteCalendar type="vacation" id={c.id} />
          </section>
        ))
      )}
    </div>
  );
}
