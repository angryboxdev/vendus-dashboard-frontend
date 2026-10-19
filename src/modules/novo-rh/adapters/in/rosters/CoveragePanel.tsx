import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useI18n } from "../../../../../i18n/I18nProvider.tsx";
import type { MessageKey } from "../../../../../i18n/i18n.ts";
import {
  Button,
  FIELD,
  IconPlus,
  IconTrash,
  LABEL,
  SECTION_TITLE,
  SURFACE,
  TimePicker,
} from "../../../../../components/ui/index.ts";
import type { CoverageRule } from "../../../domain/entities/rosters.ts";
import { windowLabel } from "../../../domain/services/roster-coverage.service.ts";
import { useNovoRh } from "../../../novo-rh.module.tsx";

const KEY = ["novo-rh", "rosters"];
const message = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);
const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7];
const label = (r: Pick<CoverageRule, "start" | "end">) => windowLabel({ ...r, startsNextDay: false, endsNextDay: r.end <= r.start });

/**
 * Plano de Cobertura (opcional por empresa): mínimos de pessoas por centro ou
 * área, por dia da semana, com exceções em datas concretas (substituem as
 * regras semanais desse dia). Só informa — a escala nunca fica bloqueada.
 */
export function CoveragePanel() {
  const { t } = useI18n();
  const { rosters, settings } = useNovoRh();
  const qc = useQueryClient();
  const status = useQuery({ queryKey: [...KEY, "coverage", "status"], queryFn: () => rosters.coverageStatus() });
  const locations = useQuery({ queryKey: ["novo-rh", "settings", "locations"], queryFn: () => settings.listLocations() });
  const [chosen, setChosen] = useState("");
  const locationId = chosen || locations.data?.[0]?.id || "";
  const [scope, setScope] = useState("");
  const areas = useQuery({ queryKey: [...KEY, "areas", locationId], queryFn: () => rosters.listAreas(locationId), enabled: !!locationId });
  const rules = useQuery({
    queryKey: [...KEY, "coverage", "rules", locationId],
    queryFn: () => rosters.listCoverageRules(locationId),
    enabled: !!locationId && status.data?.enabled === true,
  });
  const [form, setForm] = useState({ kind: "weekly" as "weekly" | "date", weekdays: [1, 2, 3, 4, 5], date: "", start: "12:00", end: "15:00", minPeople: "2" });
  const [editing, setEditing] = useState<{ id: string; minPeople: string } | null>(null);
  const done = () => qc.invalidateQueries({ queryKey: [...KEY, "coverage"] });
  const create = useMutation({
    mutationFn: async () => {
      const base = { locationId, areaId: scope || null, start: form.start, end: form.end, minPeople: Number(form.minPeople) };
      if (form.kind === "date") return [await rosters.createCoverageRule({ ...base, weekday: null, date: form.date })];
      // Uma regra por dia da semana escolhido (cada uma altera-se ou apaga-se à parte).
      const out = [];
      for (const weekday of form.weekdays) out.push(await rosters.createCoverageRule({ ...base, weekday, date: null }));
      return out;
    },
    onSettled: done,
  });
  const update = useMutation({
    mutationFn: (x: { id: string; minPeople: number }) => rosters.updateCoverageRule(x.id, { minPeople: x.minPeople }),
    onSuccess: async () => {
      setEditing(null);
      await done();
    },
  });
  const remove = useMutation({ mutationFn: (id: string) => rosters.deleteCoverageRule(id), onSuccess: done });
  // Ligar/desligar aqui mesmo (opcional por empresa): a escala e o menu reagem logo.
  const toggle = useMutation({
    mutationFn: (enabled: boolean) => rosters.setCoverageEnabled(enabled),
    onSuccess: (r) => {
      qc.setQueryData([...KEY, "coverage", "status"], r);
      return done();
    },
  });

  if (status.isLoading) return <p className="text-sm text-ink-secondary">{t("common.loading")}</p>;
  const on = status.data?.enabled === true;
  const switchCard = (
    <div className={`${SURFACE} flex flex-wrap items-start gap-4 p-4`}>
      <div className="min-w-0 flex-1">
        <p className="text-base font-semibold text-navy-900">{t("ros.cov.switch")}</p>
        <p className="mt-1 max-w-2xl text-sm text-ink-secondary">{t("ros.cov.switchHint")}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={t("ros.cov.switch")}
        disabled={toggle.isPending}
        onClick={() => toggle.mutate(!on)}
        className="flex items-center gap-2.5 rounded-full text-sm font-medium text-navy-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 disabled:opacity-60"
      >
        <span className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors duration-150 ${on ? "bg-brand-600" : "bg-line"}`}>
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-150 ${on ? "translate-x-5" : "translate-x-0.5"}`} />
        </span>
        {on ? t("ros.cov.switchOn") : t("ros.cov.switchOff")}
      </button>
      {toggle.isError && (
        <p className="w-full text-sm text-red-700" role="alert">
          {message(toggle.error, t("common.error"))}
        </p>
      )}
    </div>
  );
  if (!on)
    return (
      <div className="space-y-4">
        {switchCard}
        <p className="text-sm text-ink-secondary">{t("ros.cov.offNote")}</p>
      </div>
    );

  const activeAreas = (areas.data ?? []).filter((a) => a.active).sort((a, b) => a.sortOrder - b.sortOrder);
  const mine = (rules.data ?? []).filter((r) => (r.areaId ?? "") === scope);
  const weekly = (wd: number) => mine.filter((r) => r.weekday === wd).sort((a, b) => a.start.localeCompare(b.start));
  const exceptions = mine.filter((r) => r.date !== null).sort((a, b) => a.date!.localeCompare(b.date!) || a.start.localeCompare(b.start));
  const valid =
    form.start !== form.end &&
    /^\d+$/.test(form.minPeople) &&
    Number(form.minPeople) <= 500 &&
    (form.kind === "date" ? /^\d{4}-\d{2}-\d{2}$/.test(form.date) : form.weekdays.length > 0);
  const error = create.error ?? update.error ?? remove.error;

  const ruleRow = (r: CoverageRule) => (
    <li key={r.id} className="flex flex-wrap items-center gap-2 py-1">
      <span className="tabular-nums text-ink">{label(r)}</span>
      {editing?.id === r.id ? (
        <form
          className="flex items-center gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            update.mutate({ id: r.id, minPeople: Number(editing.minPeople) });
          }}
        >
          <input
            className={`${FIELD} w-20`}
            type="number"
            min={0}
            max={500}
            aria-label={t("ros.cov.min")}
            value={editing.minPeople}
            onChange={(e) => setEditing({ id: r.id, minPeople: e.target.value })}
          />
          <Button size="sm" variant="primary" type="submit" disabled={!/^\d+$/.test(editing.minPeople) || update.isPending}>
            {t("ros.areas.save")}
          </Button>
        </form>
      ) : (
        <button
          type="button"
          className="rounded-full bg-surface-soft px-2.5 py-0.5 text-xs font-semibold text-navy-900 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
          aria-label={`${t("ros.cov.editMin")} ${label(r)}`}
          onClick={() => setEditing({ id: r.id, minPeople: String(r.minPeople) })}
        >
          {t("ros.cov.minOf", { count: r.minPeople })}
        </button>
      )}
      <Button size="sm" variant="tertiary" aria-label={`${t("ros.cov.remove")} ${r.date ?? t(`ros.cov.wd.${r.weekday}` as MessageKey)} ${label(r)}`} disabled={remove.isPending} onClick={() => remove.mutate(r.id)}>
        <IconTrash size={14} />
      </Button>
    </li>
  );

  return (
    <div className="space-y-4">
      {switchCard}
    <section className={`${SURFACE} space-y-5 p-4`}>
      <p className="text-sm text-ink-secondary">{t("ros.cov.hint")}</p>
      <div className="flex flex-wrap gap-3">
        <label className="block min-w-[200px]">
          <span className={LABEL}>{t("ros.areas.location")}</span>
          <select
            className={`${FIELD} w-full`}
            value={locationId}
            onChange={(e) => {
              setChosen(e.target.value);
              setScope("");
            }}
          >
            {(locations.data ?? []).map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block min-w-[200px]">
          <span className={LABEL}>{t("ros.cov.scope")}</span>
          <select className={`${FIELD} w-full`} value={scope} onChange={(e) => setScope(e.target.value)}>
            <option value="">{t("ros.cov.wholeCentre")}</option>
            {activeAreas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div>
        <h3 className={SECTION_TITLE}>{t("ros.cov.weekly")}</h3>
        <ul className="mt-2 divide-y divide-line-subtle rounded-xl border border-line text-sm" aria-label={t("ros.cov.weekly")}>
          {WEEKDAYS.map((wd) => (
            <li key={wd} className="flex flex-wrap items-start gap-3 px-3 py-2">
              <span className="w-20 shrink-0 pt-1 font-medium text-navy-900">{t(`ros.cov.wd.${wd}` as MessageKey)}</span>
              {weekly(wd).length ? (
                <ul className="flex-1" aria-label={t(`ros.cov.wd.${wd}` as MessageKey)}>
                  {weekly(wd).map(ruleRow)}
                </ul>
              ) : (
                <span className="pt-1 text-ink-muted">{t("ros.cov.notConfigured")}</span>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className={SECTION_TITLE}>{t("ros.cov.exceptions")}</h3>
        {exceptions.length ? (
          <ul className="mt-2 divide-y divide-line-subtle rounded-xl border border-line px-3 text-sm" aria-label={t("ros.cov.exceptions")}>
            {exceptions.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 py-1">
                <span className="w-24 shrink-0 font-medium tabular-nums text-navy-900">{r.date}</span>
                <ul className="flex-1">{ruleRow(r)}</ul>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-sm text-ink-muted">{t("ros.cov.noExceptions")}</p>
        )}
      </div>

      <form
        className="space-y-3 rounded-xl border border-line p-3"
        aria-label={t("ros.cov.add")}
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
      >
        <fieldset className="flex flex-wrap items-center gap-4 text-sm">
          <legend className={LABEL}>{t("ros.cov.when")}</legend>
          <label className="flex items-center gap-1.5">
            <input type="radio" name="cov-kind" checked={form.kind === "weekly"} onChange={() => setForm({ ...form, kind: "weekly" })} />
            {t("ros.cov.weekly")}
          </label>
          <label className="flex items-center gap-1.5">
            <input type="radio" name="cov-kind" checked={form.kind === "date"} onChange={() => setForm({ ...form, kind: "date" })} />
            {t("ros.cov.exception")}
          </label>
        </fieldset>
        {form.kind === "weekly" ? (
          <fieldset className="flex flex-wrap gap-3 text-sm">
            <legend className="sr-only">{t("ros.cov.days")}</legend>
            {WEEKDAYS.map((wd) => (
              <label key={wd} className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={form.weekdays.includes(wd)}
                  onChange={(e) => setForm({ ...form, weekdays: e.target.checked ? [...form.weekdays, wd].sort() : form.weekdays.filter((x) => x !== wd) })}
                />
                {t(`ros.cov.wd.${wd}` as MessageKey)}
              </label>
            ))}
          </fieldset>
        ) : (
          <label className="block max-w-[200px]">
            <span className={LABEL}>{t("ros.cov.date")}</span>
            <input type="date" className={`${FIELD} w-full`} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </label>
        )}
        <div className="flex flex-wrap items-end gap-3">
          <TimePicker label={t("ros.template.start")} value={form.start} onChange={(start) => setForm({ ...form, start })} />
          <span className="pb-2 text-ink-muted">–</span>
          <TimePicker label={t("ros.template.end")} value={form.end} onChange={(end) => setForm({ ...form, end })} />
          <label>
            <span className={LABEL}>{t("ros.cov.min")}</span>
            <input className={`${FIELD} w-24`} type="number" min={0} max={500} value={form.minPeople} onChange={(e) => setForm({ ...form, minPeople: e.target.value })} />
          </label>
          <Button variant="primary" type="submit" icon={<IconPlus size={16} />} disabled={!locationId || !valid || create.isPending}>
            {t("ros.cov.add")}
          </Button>
        </div>
        {form.end <= form.start && form.start !== form.end && <p className="text-xs text-ink-secondary">{t("ros.cov.overnight")}</p>}
      </form>
      {error && (
        <p className="text-sm text-red-700" role="alert">
          {message(error, t("common.error"))}
        </p>
      )}
    </section>
    </div>
  );
}
