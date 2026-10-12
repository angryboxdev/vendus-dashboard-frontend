import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useI18n } from "../../../../../i18n/I18nProvider.tsx";
import { FIELD, LABEL, SECTION_TITLE, SURFACE, TABLE, TD, TH, THEAD, TR } from "../../../../../components/ui/index.ts";
import type { SettingDefinition, ValueOrigin } from "../../../domain/entities/settings.ts";
import { formatSettingValue, LEVEL_KEY, todayIn } from "../../../domain/services/settings-format.service.ts";
import { useNovoRh } from "../../../novo-rh.module.tsx";

/** C11.4: por colaborador e data — valor efetivo, origem e o que herdaria. */
export function EffectivePanel({ definitions }: { definitions: SettingDefinition[] }) {
  const { t } = useI18n();
  const { settings } = useNovoRh();
  const [employeeId, setEmployeeId] = useState("");
  const [date, setDate] = useState(todayIn());
  const employees = useQuery({ queryKey: ["novo-rh", "settings", "employees"], queryFn: () => settings.listEmployees() });
  const effective = useQuery({
    queryKey: ["novo-rh", "settings", "effective", employeeId, date],
    queryFn: () => settings.effective(employeeId, date),
    enabled: !!employeeId && /^\d{4}-\d{2}-\d{2}$/.test(date),
  });
  const words = { yes: t("common.yes"), no: t("common.no") };
  const defOf = (key: string) => definitions.find((d) => d.key === key);
  const origin = (o: ValueOrigin) => `${t(LEVEL_KEY[o.level])}${o.profileName ? ` · ${o.profileName}` : ""}`;

  return (
    <section className={`${SURFACE} p-4`} aria-labelledby="settings-effective">
      <h2 id="settings-effective" className={SECTION_TITLE}>
        {t("settings.effective.title")}
      </h2>
      <p className="text-xs text-stone-500">{t("settings.effective.hint")}</p>
      <div className="mt-3 flex flex-wrap gap-3">
        <div>
          <label htmlFor="effective-employee" className={LABEL}>
            {t("common.employee")}
          </label>
          <select id="effective-employee" className={`${FIELD} min-w-[220px]`} value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
            <option value="">{t("common.choose")}</option>
            {(employees.data ?? []).map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="effective-date" className={LABEL}>
            {t("common.date")}
          </label>
          <input id="effective-date" type="date" className={FIELD} value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>
      {effective.data && (
        <div className="mt-3 overflow-x-auto">
          <table className={TABLE}>
            <thead className={THEAD}>
              <tr>
                <th className={TH}>{t("settings.history.param")}</th>
                <th className={TH}>{t("settings.edit.value")}</th>
                <th className={TH}>{t("settings.effective.origin")}</th>
                <th className={TH}>{t("settings.effective.inherited")}</th>
              </tr>
            </thead>
            <tbody>
              {effective.data.map((s) => (
                <tr key={s.key} className={TR}>
                  <td className={TD}>{defOf(s.key)?.label ?? s.key}</td>
                  <td className={`${TD} font-semibold`}>{formatSettingValue(defOf(s.key), s.value, words)}</td>
                  <td className={TD}>{origin(s.origin)}</td>
                  <td className={`${TD} text-stone-500`}>{s.inherited ? `${formatSettingValue(defOf(s.key), s.inherited.value, words)} (${origin(s.inherited.origin)})` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {effective.isError && <p className="mt-2 text-sm text-red-700">{t("common.loadError")}</p>}
    </section>
  );
}
