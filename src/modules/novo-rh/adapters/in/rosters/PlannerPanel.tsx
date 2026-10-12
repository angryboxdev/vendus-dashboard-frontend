import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useI18n } from "../../../../../i18n/I18nProvider.tsx";
import { AlertBanner, Button, FIELD, IconChevronLeft, IconChevronRight, LABEL, SECTION_TITLE, SURFACE, TABLE, TD, TH, THEAD } from "../../../../../components/ui/index.ts";
import type { PublishOptions, RosterShift, Violation } from "../../../domain/entities/rosters.ts";
import { weekOf } from "../../../domain/services/attendance.service.ts";
import { cellLabel, daysFrom, violationsOf } from "../../../domain/services/rosters.service.ts";
import { todayIn } from "../../../domain/services/settings-format.service.ts";
import { useNovoRh } from "../../../novo-rh.module.tsx";

const KEY = ["novo-rh", "rosters"];
const message = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);
const plus = (d: string, n: number) => daysFrom(d, n + 1).at(-1)!;
const ddmm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

/** Avisos (pedem confirmação) ou bloqueios devolvidos pela API (RE-16). */
function ViolationsBox({ kind, violations, name, onConfirm }: { kind: "confirm" | "blocked"; violations: Violation[]; name: (id: string) => string; onConfirm?: () => void }) {
  const { t } = useI18n();
  return (
    <AlertBanner
      tone={kind === "blocked" ? "danger" : "warning"}
      title={kind === "blocked" ? t("ros.blocked") : t("ros.warnings")}
      action={
        kind === "confirm" && onConfirm ? (
          <Button size="sm" onClick={onConfirm}>
            {t("ros.publish.confirm")}
          </Button>
        ) : undefined
      }
    >
      <ul className="list-disc pl-4">
        {violations.map((v, i) => (
          <li key={i}>
            {name(v.employeeId)}: {v.message}
          </li>
        ))}
      </ul>
    </AlertBanner>
  );
}

/** Escala (F-04.1): grelha de 2 semanas, rascunho, publicar com versões, em massa e histórico. */
export function PlannerPanel() {
  const { t } = useI18n();
  const { rosters, settings, structure } = useNovoRh();
  const qc = useQueryClient();
  const [rosterId, setRosterId] = useState("");
  const [from, setFrom] = useState(() => weekOf(todayIn()).from);
  const to = plus(from, 13);
  const days = daysFrom(from, 14);
  const [paint, setPaint] = useState("");
  const [extraRows, setExtraRows] = useState<string[]>([]);
  const [selected, setSelected] = useState<RosterShift | null>(null);
  const [reason, setReason] = useState("");
  const [publishNote, setPublishNote] = useState("");
  const [problem, setProblem] = useState<{ kind: "confirm" | "blocked"; violations: Violation[]; retry: () => void } | null>(null);

  const list = useQuery({ queryKey: [...KEY, "list"], queryFn: () => rosters.listRosters() });
  const templates = useQuery({ queryKey: [...KEY, "templates"], queryFn: () => rosters.listTemplates() });
  const employees = useQuery({ queryKey: ["novo-rh", "settings", "employees"], queryFn: () => settings.listEmployees() });
  const locations = useQuery({ queryKey: ["novo-rh", "settings", "locations"], queryFn: () => settings.listLocations() });
  const groups = useQuery({ queryKey: ["novo-rh", "structure", "groups"], queryFn: () => structure.listGroups() });
  const shifts = useQuery({ queryKey: [...KEY, "shifts", rosterId, from], queryFn: () => rosters.listShifts(rosterId, from, to), enabled: !!rosterId });
  const history = useQuery({ queryKey: [...KEY, "history", rosterId], queryFn: () => rosters.history(rosterId), enabled: !!rosterId });
  const name = (id: string) => employees.data?.find((e) => e.id === id)?.label ?? id;
  const tpls = (templates.data ?? []).filter((x) => !x.archived);
  const refresh = () => qc.invalidateQueries({ queryKey: KEY });

  const rows = useMemo(() => {
    const ids = new Set([...(shifts.data?.shifts ?? []).filter((s) => !s.deleted).map((s) => s.employeeId), ...extraRows]);
    return [...ids].sort((a, b) => name(a).localeCompare(name(b), "pt"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shifts.data, extraRows, employees.data]);

  /** Corre uma ação que pode devolver avisos (409) ou bloqueios (422); "Publicar mesmo assim" repete com confirmação. */
  const guarded = async (action: (opts: PublishOptions) => Promise<unknown>, opts: PublishOptions) => {
    setProblem(null);
    try {
      await action(opts);
      await refresh();
      return true;
    } catch (e) {
      const v = violationsOf(e);
      if (!v) throw e;
      setProblem({ ...v, retry: () => void guarded(action, { ...opts, confirm: true }) });
      return false;
    }
  };

  const add = useMutation({
    mutationFn: (v: { employeeId: string; workDate: string }) =>
      rosters.addShift(rosterId, { employeeId: v.employeeId, workDate: v.workDate, kind: paint === "day_off" ? "day_off" : "shift", templateId: paint === "day_off" ? null : paint, segments: [] }),
    onSuccess: (r) => {
      if (r.warnings.length) setProblem({ kind: "confirm", violations: r.warnings, retry: () => setProblem(null) });
      return refresh();
    },
  });
  const change = useMutation({
    mutationFn: (s: RosterShift) => guarded((o) => rosters.updateShift(s.id, paint === "day_off" ? { kind: "day_off" } : { kind: "shift", templateId: paint }, o), { reason: reason.trim() || null, confirm: false }),
    onSuccess: (ok) => ok && setSelected(null),
  });
  const remove = useMutation({
    mutationFn: (s: RosterShift) => guarded((o) => rosters.deleteShift(s.id, o), { reason: reason.trim() || null, confirm: false }),
    onSuccess: (ok) => ok && setSelected(null),
  });
  const publish = useMutation({ mutationFn: () => guarded((o) => rosters.publish(rosterId, o), { reason: publishNote.trim() || null, confirm: false }) });

  const [newRoster, setNewRoster] = useState({ name: "", targetType: "location" as "location" | "group", targetId: "" });
  const create = useMutation({
    mutationFn: () => rosters.createRoster(newRoster),
    onSuccess: async (r) => {
      setRosterId(r.id);
      setNewRoster({ ...newRoster, name: "" });
      await refresh();
    },
  });
  const targets = newRoster.targetType === "location" ? (locations.data ?? []).map((l) => ({ id: l.id, label: l.label })) : (groups.data ?? []).map((g) => ({ id: g.id, label: g.name }));

  return (
    <div className="space-y-4">
      <section className={`${SURFACE} space-y-3 p-4`}>
        <div className="flex flex-wrap items-end gap-2">
          <label>
            <span className={LABEL}>{t("ros.roster")}</span>
            <select className={`${FIELD} min-w-[200px]`} value={rosterId} onChange={(e) => setRosterId(e.target.value)}>
              <option value="">{t("common.choose")}…</option>
              {(list.data ?? [])
                .filter((r) => !r.archived)
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
            </select>
          </label>
          <div className="flex flex-wrap items-end gap-2" role="group" aria-label={t("ros.roster.new")}>
            <label>
              <span className={LABEL}>{t("ros.field.name")}</span>
              <input className={FIELD} value={newRoster.name} onChange={(e) => setNewRoster({ ...newRoster, name: e.target.value })} />
            </label>
            <label>
              <span className={LABEL}>{t("ros.field.targetType")}</span>
              <select className={FIELD} value={newRoster.targetType} onChange={(e) => setNewRoster({ ...newRoster, targetType: e.target.value as "location" | "group", targetId: "" })}>
                <option value="location">{t("ros.target.location")}</option>
                <option value="group">{t("ros.target.group")}</option>
              </select>
            </label>
            <label>
              <span className={LABEL}>{t("ros.field.target")}</span>
              <select className={FIELD} value={newRoster.targetId} onChange={(e) => setNewRoster({ ...newRoster, targetId: e.target.value })}>
                <option value="">{t("common.choose")}…</option>
                {targets.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.label}
                  </option>
                ))}
              </select>
            </label>
            <Button disabled={!newRoster.name.trim() || !newRoster.targetId || create.isPending} onClick={() => create.mutate()}>
              {t("ros.roster.new")}
            </Button>
          </div>
        </div>
        {list.data && list.data.length === 0 && <p className="text-sm text-stone-500">{t("ros.roster.none")}</p>}
      </section>

      {rosterId && shifts.data && (
        <section className={`${SURFACE} space-y-3 p-4`}>
          <div className="flex flex-wrap items-end gap-2">
            <Button size="sm" icon={<IconChevronLeft />} aria-label={t("ros.prevWeek")} onClick={() => setFrom(plus(from, -7))} />
            <span className="pb-1 text-sm text-stone-700">
              {ddmm(from)} – {ddmm(to)}
            </span>
            <Button size="sm" icon={<IconChevronRight />} aria-label={t("ros.nextWeek")} onClick={() => setFrom(plus(from, 7))} />
            <label>
              <span className={LABEL}>{t("ros.paint")}</span>
              <select className={FIELD} value={paint} onChange={(e) => setPaint(e.target.value)}>
                <option value="">{t("common.choose")}…</option>
                {tpls.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.abbreviation} · {x.name}
                  </option>
                ))}
                <option value="day_off">{t("ros.dayOff")}</option>
              </select>
            </label>
            <label>
              <span className={LABEL}>{t("ros.addEmployee")}</span>
              <select className={FIELD} value="" onChange={(e) => e.target.value && setExtraRows([...extraRows, e.target.value])}>
                <option value="">{t("common.employee")}…</option>
                {(employees.data ?? [])
                  .filter((e) => !rows.includes(e.id))
                  .map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.label}
                    </option>
                  ))}
              </select>
            </label>
          </div>

          <div className="overflow-auto">
            <table className={TABLE}>
              <thead className={THEAD}>
                <tr>
                  <th className={TH}>{t("common.employee")}</th>
                  {days.map((d) => (
                    <th key={d} className={`${TH} text-center`}>
                      {ddmm(d)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((emp) => (
                  <tr key={emp} className="border-b border-stone-100">
                    <td className={`${TD} whitespace-nowrap`}>{name(emp)}</td>
                    {days.map((d) => {
                      const cell = shifts.data.shifts.filter((s) => s.employeeId === emp && s.workDate === d && !s.deleted);
                      return (
                        <td key={d} className="px-1 py-1 text-center">
                          {cell.length ? (
                            cell.map((s) => (
                              <button
                                key={s.id}
                                type="button"
                                aria-label={`${name(emp)} ${d}`}
                                onClick={() => setSelected(s)}
                                className={`block w-full rounded px-1 py-0.5 text-xs font-semibold ${s.dirty ? "border border-dashed border-[#ED5C32] text-[#ED5C32]" : "bg-stone-100 text-stone-800"}`}
                                title={s.dirty ? t("ros.cell.unpublished") : undefined}
                              >
                                {cellLabel(s, tpls)}
                              </button>
                            ))
                          ) : (
                            <button type="button" aria-label={`${name(emp)} ${d}`} disabled={!paint || add.isPending} onClick={() => add.mutate({ employeeId: emp, workDate: d })} className="block h-6 w-full rounded hover:bg-[#FDF8F5] disabled:cursor-default" />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {selected && (
            <div className="flex flex-wrap items-end gap-2 rounded-md border border-stone-200 p-3" role="group" aria-label={t("ros.selected", { name: name(selected.employeeId), date: selected.workDate })}>
              <span className="pb-1 text-sm font-medium text-stone-900">{t("ros.selected", { name: name(selected.employeeId), date: selected.workDate })}</span>
              {selected.published && (
                <label className="min-w-[220px] flex-1">
                  <span className={LABEL}>{t("ros.reason")}</span>
                  <input className={`${FIELD} w-full`} value={reason} onChange={(e) => setReason(e.target.value)} />
                </label>
              )}
              <Button disabled={!paint || change.isPending || (!!selected.published && !reason.trim())} onClick={() => change.mutate(selected)}>
                {t("ros.change")}
              </Button>
              <Button variant="tertiary" disabled={remove.isPending || (!!selected.published && !reason.trim())} onClick={() => remove.mutate(selected)}>
                {t("ros.remove")}
              </Button>
              {(change.isError || remove.isError) && <p className="w-full text-sm text-red-700">{message(change.error ?? remove.error, t("common.error"))}</p>}
            </div>
          )}

          {problem && <ViolationsBox kind={problem.kind} violations={problem.violations} name={name} onConfirm={problem.retry} />}

          <div className="flex flex-wrap items-end gap-2">
            <span className="pb-1 text-sm text-stone-700">{t("ros.pending", { count: shifts.data.pending })}</span>
            <label className="min-w-[220px] flex-1">
              <span className={LABEL}>{t("ros.publish.reason")}</span>
              <input className={`${FIELD} w-full`} value={publishNote} onChange={(e) => setPublishNote(e.target.value)} />
            </label>
            <Button variant="primary" disabled={shifts.data.pending === 0 || publish.isPending} onClick={() => publish.mutate()}>
              {t("ros.publish")}
            </Button>
          </div>
          {publish.isError && <p className="text-sm text-red-700">{message(publish.error, t("common.error"))}</p>}

          <BulkAssign rosterId={rosterId} defaultFrom={from} defaultTo={to} />

          {!!history.data?.length && (
            <div>
              <h3 className={SECTION_TITLE}>{t("ros.history")}</h3>
              <ul className="mt-1 space-y-0.5 text-sm text-stone-700">
                {history.data.map((h) => (
                  <li key={h.id}>
                    {t("ros.history.row", { version: h.version, date: h.createdAt.slice(0, 10), by: h.publishedBy, count: h.changes.length })}
                    {h.reason && ` — ${h.reason}`}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function BulkAssign({ rosterId, defaultFrom, defaultTo }: { rosterId: string; defaultFrom: string; defaultTo: string }) {
  const { t } = useI18n();
  const { rosters, settings } = useNovoRh();
  const qc = useQueryClient();
  const employees = useQuery({ queryKey: ["novo-rh", "settings", "employees"], queryFn: () => settings.listEmployees() });
  const templates = useQuery({ queryKey: [...KEY, "templates"], queryFn: () => rosters.listTemplates() });
  const [v, setV] = useState({ employeeIds: [] as string[], from: defaultFrom, to: defaultTo, weekdays: ["1", "2", "3", "4", "5"], templateId: "" });
  const m = useMutation({
    mutationFn: () => rosters.assignBulk(rosterId, { employeeIds: v.employeeIds, from: v.from, to: v.to, weekdays: v.weekdays, kind: v.templateId === "day_off" ? "day_off" : "shift", templateId: v.templateId === "day_off" ? null : v.templateId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
  const WD = ["1", "2", "3", "4", "5", "6", "7"];
  return (
    <details className="rounded-md border border-stone-200 p-3">
      <summary className="cursor-pointer text-sm font-semibold text-stone-900">{t("ros.bulk")}</summary>
      <div className="mt-2 flex flex-wrap items-end gap-2">
        <label>
          <span className={LABEL}>{t("ros.bulk.employees")}</span>
          <select multiple className={`${FIELD} min-w-[200px]`} value={v.employeeIds} onChange={(e) => setV({ ...v, employeeIds: [...e.target.selectedOptions].map((o) => o.value) })}>
            {(employees.data ?? []).map((e) => (
              <option key={e.id} value={e.id}>
                {e.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className={LABEL}>{t("common.from")}</span>
          <input type="date" className={FIELD} value={v.from} onChange={(e) => setV({ ...v, from: e.target.value })} />
        </label>
        <label>
          <span className={LABEL}>{t("common.to")}</span>
          <input type="date" className={FIELD} value={v.to} onChange={(e) => setV({ ...v, to: e.target.value })} />
        </label>
        <fieldset className="flex items-center gap-1 pb-2 text-xs text-stone-700">
          <legend className={LABEL}>{t("ros.bulk.weekdays")}</legend>
          {WD.map((d) => (
            <label key={d} className="flex items-center gap-0.5">
              <input type="checkbox" checked={v.weekdays.includes(d)} onChange={(e) => setV({ ...v, weekdays: e.target.checked ? [...v.weekdays, d] : v.weekdays.filter((x) => x !== d) })} />
              {d}
            </label>
          ))}
        </fieldset>
        <label>
          <span className={LABEL}>{t("ros.tab.templates")}</span>
          <select className={FIELD} value={v.templateId} onChange={(e) => setV({ ...v, templateId: e.target.value })}>
            <option value="">{t("common.choose")}…</option>
            {(templates.data ?? [])
              .filter((x) => !x.archived)
              .map((x) => (
                <option key={x.id} value={x.id}>
                  {x.abbreviation} · {x.name}
                </option>
              ))}
            <option value="day_off">{t("ros.dayOff")}</option>
          </select>
        </label>
        <Button disabled={!v.employeeIds.length || !v.templateId || m.isPending} onClick={() => m.mutate()}>
          {t("ros.bulk")}
        </Button>
        {m.data && <span className="text-xs text-stone-600">{t("ros.bulk.done", { count: m.data.created })}</span>}
        {m.isError && <p className="w-full text-sm text-red-700">{message(m.error, t("common.error"))}</p>}
      </div>
    </details>
  );
}
