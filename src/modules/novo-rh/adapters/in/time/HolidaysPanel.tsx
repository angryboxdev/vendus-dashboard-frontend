import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useI18n } from "../../../../../i18n/I18nProvider.tsx";
import type { MessageKey } from "../../../../../i18n/i18n.ts";
import { AlertBanner, Button, FIELD, IconClose, IconPlus, SECTION_TITLE, StatusBadge, SURFACE, TABLE, TD, TH, THEAD, TR } from "../../../../../components/ui/index.ts";
import type { HolidayCalendar, HolidayKind } from "../../../domain/entities/time.ts";
import { useNovoRh } from "../../../novo-rh.module.tsx";
import { AssignmentsBox } from "./AssignmentsBox.tsx";
import { DeleteCalendar } from "./DeleteCalendar.tsx";

function CalendarCard({ c }: { c: HolidayCalendar }) {
  const { t } = useI18n();
  const { time } = useNovoRh();
  const qc = useQueryClient();
  const year = new Date().getFullYear();
  const [form, setForm] = useState({ date: "", name: "", kind: "municipal" as HolidayKind, source: "" });
  const refresh = () => void qc.invalidateQueries({ queryKey: ["novo-rh", "time"] });
  const imp = useMutation({ mutationFn: (y: number) => time.importNational(c.id, y), onSuccess: refresh });
  const add = useMutation({
    mutationFn: () => time.addHoliday(c.id, { date: form.date, name: form.name, kind: form.kind, status: "to_confirm", coefficient: null, source: form.source || null }),
    onSuccess: () => (setForm({ ...form, date: "", name: "" }), refresh()),
  });
  const confirm = useMutation({ mutationFn: (id: string) => time.updateHoliday(id, { status: "confirmed" }), onSuccess: refresh });
  const remove = useMutation({ mutationFn: (id: string) => time.removeHoliday(id), onSuccess: refresh });
  const err = imp.error ?? add.error ?? confirm.error ?? remove.error;

  return (
    <section className={`${SURFACE} space-y-3 p-4`} aria-label={c.name}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className={SECTION_TITLE}>
          {c.name} {c.country && <span className="text-xs text-stone-400">{c.country}</span>}
        </h3>
        <div className="flex gap-2">
          {[year, year + 1].map((y) => (
            <Button key={y} size="sm" disabled={!c.country || imp.isPending} onClick={() => imp.mutate(y)}>
              {t("time.holidays.import", { year: y })}
            </Button>
          ))}
        </div>
      </div>
      <p className="text-xs text-stone-500">
        {t("time.holidays.coefficient")}: {c.compensationCoefficient} · {t("time.holidays.toConfirmHint")}
      </p>
      {imp.data && <p className="text-sm text-stone-700">{t("time.holidays.imported", imp.data)}</p>}
      <div className="max-h-72 overflow-auto">
        <table className={TABLE}>
          <thead className={THEAD}>
            <tr>
              <th className={TH}>{t("common.date")}</th>
              <th className={TH}>{t("common.name")}</th>
              <th className={TH}>{t("contracts.type")}</th>
              <th className={TH}>{t("people.col.status")}</th>
              <th className={TH}>
                <span className="sr-only">{t("time.holidays.confirm")}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {c.days.map((d) => (
              <tr key={d.id} className={TR}>
                <td className={TD}>{d.date}</td>
                <td className={TD} title={d.source ?? ""}>
                  {d.name}
                </td>
                <td className={TD}>{t(`time.holidays.kind.${d.kind}` as MessageKey)}</td>
                <td className={TD}>
                  <StatusBadge tone={d.status === "confirmed" ? "success" : "warning"}>{d.status === "confirmed" ? t("time.holidays.confirmed") : t("time.holidays.toConfirm")}</StatusBadge>
                </td>
                <td className={`${TD} whitespace-nowrap`}>
                  {d.status === "to_confirm" && (
                    <Button size="sm" variant="tertiary" onClick={() => confirm.mutate(d.id)} aria-label={`${t("time.holidays.confirm")} ${d.name}`}>
                      {t("time.holidays.confirm")}
                    </Button>
                  )}
                  <Button size="sm" variant="tertiary" icon={<IconClose />} onClick={() => remove.mutate(d.id)} aria-label={`${t("common.archive")} ${d.name}`} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid gap-2 sm:grid-cols-[150px_1fr_130px_1fr_auto]">
        <input aria-label={t("common.date")} type="date" className={FIELD} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
        <input aria-label={t("common.name")} placeholder={t("common.name")} className={FIELD} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <select aria-label={t("contracts.type")} className={FIELD} value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as HolidayKind })}>
          {(["regional", "municipal", "custom", "national"] as const).map((k) => (
            <option key={k} value={k}>
              {t(`time.holidays.kind.${k}` as MessageKey)}
            </option>
          ))}
        </select>
        <input aria-label={t("time.holidays.source")} placeholder={t("time.holidays.source")} className={FIELD} value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} />
        <Button size="sm" icon={<IconPlus />} disabled={!form.date || !form.name.trim() || add.isPending} onClick={() => add.mutate()}>
          {t("time.holidays.add")}
        </Button>
      </div>
      {err && (
        <AlertBanner tone="danger" title={t("common.error")}>
          {err instanceof Error ? err.message : ""}
        </AlertBanner>
      )}
      <AssignmentsBox resourceType="holiday_calendar" resourceId={c.id} />
      <DeleteCalendar type="holiday" id={c.id} />
    </section>
  );
}

/** Tempo → Feriados: calendários por centro, importação "a confirmar", confirmar com fonte oficial. */
export function HolidaysPanel() {
  const { t } = useI18n();
  const { time } = useNovoRh();
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: "", country: "PT", coefficient: "1", approval: false });
  const list = useQuery({ queryKey: ["novo-rh", "time", "holidays"], queryFn: () => time.listHolidayCalendars() });
  const create = useMutation({
    mutationFn: () =>
      time.createHolidayCalendar({
        name: form.name,
        country: form.country.trim().toUpperCase() || null,
        compensationCoefficient: Number(form.coefficient || 1),
        approvalRequired: form.approval,
        accruedExpires: false,
        halfDayCompensation: false,
      }),
    onSuccess: () => (setForm({ ...form, name: "" }), void qc.invalidateQueries({ queryKey: ["novo-rh", "time"] })),
  });
  return (
    <div className="space-y-4">
      <section className={`${SURFACE} space-y-2 p-4`} aria-labelledby="new-holcal">
        <h2 id="new-holcal" className={SECTION_TITLE}>
          {t("time.holidays.new")}
        </h2>
        <div className="grid gap-2 sm:grid-cols-[1fr_100px_120px_auto_auto]">
          <input aria-label={t("common.name")} placeholder={t("common.name")} className={FIELD} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input aria-label={t("time.holidays.country")} className={FIELD} maxLength={2} value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
          <input aria-label={t("time.holidays.coefficient")} type="number" step="0.5" min={0} className={FIELD} value={form.coefficient} onChange={(e) => setForm({ ...form, coefficient: e.target.value })} />
          <label className="flex items-center gap-1 text-sm text-stone-700">
            <input type="checkbox" checked={form.approval} onChange={(e) => setForm({ ...form, approval: e.target.checked })} />
            {t("time.holidays.approval")}
          </label>
          <Button variant="primary" icon={<IconPlus />} disabled={!form.name.trim() || create.isPending} onClick={() => create.mutate()}>
            {t("common.add")}
          </Button>
        </div>
        <p className="text-xs text-stone-500">{t("time.holidays.coefficientHint")}</p>
        {create.isError && <p className="text-xs text-red-700">{create.error instanceof Error ? create.error.message : ""}</p>}
      </section>
      {(list.data ?? []).length === 0 ? <p className="text-sm text-stone-500">{t("time.holidays.empty")}</p> : list.data!.map((c) => <CalendarCard key={c.id} c={c} />)}
    </div>
  );
}
