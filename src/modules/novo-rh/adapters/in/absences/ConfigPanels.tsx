import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useI18n } from "../../../../../i18n/I18nProvider.tsx";
import type { MessageKey } from "../../../../../i18n/i18n.ts";
import { Button, Drawer, FIELD, IconClose, IconPlus, LABEL, StatusBadge, SURFACE, TABLE, TD, TH, THEAD, TR } from "../../../../../components/ui/index.ts";
import type { AbsenceTypeInput, FlowLevel } from "../../../domain/entities/absences.ts";
import { emptyType, flowProblems } from "../../../domain/services/absences.service.ts";
import { useNovoRh } from "../../../novo-rh.module.tsx";

const KEY = ["novo-rh", "absences"];
const message = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

/** Tipos de ausência (C5.3): nada vem preenchido com valores legais (D6). */
export function TypesPanel() {
  const { t } = useI18n();
  const { absences } = useNovoRh();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const q = useQuery({ queryKey: [...KEY, "types"], queryFn: () => absences.listTypes() });
  const archive = useMutation({ mutationFn: (id: string) => absences.archiveType(id), onSuccess: () => qc.invalidateQueries({ queryKey: KEY }) });
  const types = (q.data ?? []).filter((x) => !x.archived);
  return (
    <section className={`${SURFACE} space-y-3 p-4`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs text-stone-500">{t("abs.types.hint")}</p>
        <Button variant="primary" icon={<IconPlus />} onClick={() => setOpen(true)}>
          {t("abs.types.new")}
        </Button>
      </div>
      {q.data && types.length === 0 && <p className="text-sm text-stone-500">{t("abs.types.none")}</p>}
      {types.length > 0 && (
        <table className={TABLE}>
          <thead className={THEAD}>
            <tr>
              <th className={TH}>{t("abs.field.name")}</th>
              <th className={TH}>{t("abs.field.category")}</th>
              <th className={TH}>{t("abs.field.counting")}</th>
              <th className={TH}>{t("abs.field.limit")}</th>
              <th className={TH}>{t("abs.field.timeImpact")}</th>
              <th className={TH} />
            </tr>
          </thead>
          <tbody>
            {types.map((x) => (
              <tr key={x.id} className={TR}>
                <td className={TD}>
                  <span className="flex flex-wrap items-center gap-1">
                    {x.name}
                    {x.private && <StatusBadge tone="neutral">{t("abs.private")}</StatusBadge>}
                  </span>
                </td>
                <td className={TD}>{t(`abs.category.${x.category}` as MessageKey)}</td>
                <td className={TD}>{x.unit === "hours" ? t("abs.unit.hours") : t(`abs.counting.${x.counting}` as MessageKey)}</td>
                <td className={TD}>{x.limitAmount ?? "—"}</td>
                <td className={TD}>{t(`abs.impact.${x.timeImpact}` as MessageKey)}</td>
                <td className={TD}>
                  <Button size="sm" variant="tertiary" aria-label={`${t("abs.archive")} ${x.name}`} disabled={archive.isPending} onClick={() => archive.mutate(x.id)}>
                    {t("abs.archive")}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {archive.isError && <p className="text-sm text-red-700">{message(archive.error, t("common.error"))}</p>}
      {open && <TypeDrawer onClose={() => setOpen(false)} />}
    </section>
  );
}

function TypeDrawer({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const { absences } = useNovoRh();
  const qc = useQueryClient();
  const flows = useQuery({ queryKey: [...KEY, "flows"], queryFn: () => absences.listFlows() });
  const [v, setV] = useState<AbsenceTypeInput>(emptyType);
  const set = <K extends keyof AbsenceTypeInput>(k: K, value: AbsenceTypeInput[K]) => setV((cur) => ({ ...cur, [k]: value }));
  const save = useMutation({
    mutationFn: () => absences.createType(v),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: KEY });
      onClose();
    },
  });
  const select = <K extends keyof AbsenceTypeInput>(k: K, label: string, options: string[], prefix: string) => (
    <label className="block">
      <span className={LABEL}>{label}</span>
      <select className={`${FIELD} w-full`} value={String(v[k])} onChange={(e) => set(k, e.target.value as AbsenceTypeInput[K])}>
        {options.map((o) => (
          <option key={o} value={o}>
            {t(`${prefix}.${o}` as MessageKey)}
          </option>
        ))}
      </select>
    </label>
  );
  const check = (k: "requiresApproval" | "private" | "hiddenFromEmployee" | "allowNegative" | "intersectSchedule" | "halfDay", label: string) => (
    <label className="flex items-center gap-2 text-sm text-stone-700">
      <input type="checkbox" checked={v[k]} onChange={(e) => set(k, e.target.checked)} />
      {label}
    </label>
  );
  return (
    <Drawer
      open
      title={t("abs.types.new")}
      description={t("abs.types.hint")}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>{t("common.cancel")}</Button>
          <Button variant="primary" disabled={!v.name.trim() || save.isPending} onClick={() => save.mutate()}>
            {t("common.save")}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <label className="block">
          <span className={LABEL}>{t("abs.field.name")}</span>
          <input className={`${FIELD} w-full`} maxLength={120} value={v.name} onChange={(e) => set("name", e.target.value)} />
        </label>
        {select("category", t("abs.field.category"), ["permission", "medical", "vacation", "compensation"], "abs.category")}
        {select("unit", t("abs.field.unit"), ["days", "hours"], "abs.unit")}
        {v.unit === "days" && select("counting", t("abs.field.counting"), ["working", "calendar"], "abs.counting")}
        {v.category !== "vacation" && (
          <label className="block">
            <span className={LABEL}>{t("abs.field.limit")}</span>
            <input className={`${FIELD} w-full`} inputMode="decimal" value={v.limitAmount ?? ""} onChange={(e) => set("limitAmount", e.target.value.trim() === "" ? null : Number(e.target.value.replace(",", ".")))} />
          </label>
        )}
        {select("renewal", t("abs.field.renewal"), ["calendar_year", "work_year"], "abs.renewal")}
        {select("timeImpact", t("abs.field.timeImpact"), ["reduce_theoretical", "count_as_worked", "none"], "abs.impact")}
        {select("attachment", t("abs.field.attachment"), ["none", "optional", "required"], "abs.attachment")}
        <label className="block">
          <span className={LABEL}>{t("abs.field.flow")}</span>
          <select className={`${FIELD} w-full`} value={v.flowId ?? ""} onChange={(e) => set("flowId", e.target.value || null)}>
            <option value="">{t("abs.flow.default")}</option>
            {(flows.data ?? [])
              .filter((f) => !f.archived && f.scope === "absences")
              .map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
          </select>
        </label>
        {check("requiresApproval", t("abs.field.requiresApproval"))}
        {check("private", t("abs.field.private"))}
        {check("hiddenFromEmployee", t("abs.field.hidden"))}
        {check("allowNegative", t("abs.field.allowNegative"))}
        {v.unit === "hours" && check("intersectSchedule", t("abs.field.intersect"))}
        {v.unit === "days" && check("halfDay", t("abs.field.halfDayAllowed"))}
        {save.isError && <p className="text-sm text-red-700">{message(save.error, t("common.error"))}</p>}
      </div>
    </Drawer>
  );
}

/** Fluxos de aprovação (C6.4): níveis com pessoas e papéis, pessoas de recurso (D9). */
export function FlowsPanel() {
  const { t } = useI18n();
  const { absences } = useNovoRh();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const q = useQuery({ queryKey: [...KEY, "flows"], queryFn: () => absences.listFlows() });
  const archive = useMutation({ mutationFn: (id: string) => absences.archiveFlow(id), onSuccess: () => qc.invalidateQueries({ queryKey: KEY }) });
  const flows = (q.data ?? []).filter((f) => !f.archived);
  return (
    <section className={`${SURFACE} space-y-3 p-4`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs text-stone-500">{t("abs.flows.hint")}</p>
        <Button variant="primary" icon={<IconPlus />} onClick={() => setOpen(true)}>
          {t("abs.flows.new")}
        </Button>
      </div>
      {q.data && flows.length === 0 && <p className="text-sm text-stone-500">{t("abs.flows.none")}</p>}
      <ul className="space-y-1">
        {flows.map((f) => (
          <li key={f.id} className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium text-stone-900">{f.name}</span>
            <StatusBadge tone="neutral">{t(f.scope === "clock" ? "abs.flow.scope.clock" : "abs.flow.scope.absences")}</StatusBadge>
            <span className="text-stone-500">{t("abs.flow.levels", { count: f.levels.length })}</span>
            {f.isDefault && <StatusBadge tone="success">{t("abs.flow.default")}</StatusBadge>}
            <Button size="sm" variant="tertiary" aria-label={`${t("abs.archive")} ${f.name}`} disabled={archive.isPending} onClick={() => archive.mutate(f.id)}>
              {t("abs.archive")}
            </Button>
          </li>
        ))}
      </ul>
      {archive.isError && <p className="text-sm text-red-700">{message(archive.error, t("common.error"))}</p>}
      {open && <FlowDrawer onClose={() => setOpen(false)} />}
    </section>
  );
}

function FlowDrawer({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const { absences, access } = useNovoRh();
  const qc = useQueryClient();
  const users = useQuery({ queryKey: ["novo-rh", "access", "users"], queryFn: () => access.listUsers() });
  const profiles = useQuery({ queryKey: ["novo-rh", "access", "profiles"], queryFn: () => access.listProfiles() });
  const [name, setName] = useState("");
  const [isDefault, setDefault] = useState(true);
  // FE-113: o mesmo motor de fluxos serve as ausências e as correções de ponto.
  const [scope, setScope] = useState<"absences" | "clock">("absences");
  const [levels, setLevels] = useState<FlowLevel[]>([{ people: [], roles: ["managers"] }]);
  const [fallback, setFallback] = useState<string[]>([]);
  const problems = flowProblems(levels);
  const save = useMutation({
    mutationFn: () => absences.createFlow({ name, scope, isDefault, levels, fallbackUserIds: fallback }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: KEY });
      onClose();
    },
  });
  const setLevel = (i: number, l: FlowLevel) => setLevels(levels.map((x, j) => (j === i ? l : x)));
  const multi = (e: React.ChangeEvent<HTMLSelectElement>) => [...e.target.selectedOptions].map((o) => o.value);
  return (
    <Drawer
      open
      title={t("abs.flows.new")}
      description={t("abs.flows.hint")}
      onClose={onClose}
      width="max-w-lg"
      footer={
        <>
          <Button onClick={onClose}>{t("common.cancel")}</Button>
          <Button variant="primary" disabled={!name.trim() || problems.length > 0 || save.isPending} onClick={() => save.mutate()}>
            {t("common.save")}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <label className="block">
          <span className={LABEL}>{t("abs.field.name")}</span>
          <input className={`${FIELD} w-full`} maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="block">
          <span className={LABEL}>{t("abs.flow.scope")}</span>
          <select className={`${FIELD} w-full`} value={scope} onChange={(e) => setScope(e.target.value as "absences" | "clock")}>
            <option value="absences">{t("abs.flow.scope.absences")}</option>
            <option value="clock">{t("abs.flow.scope.clock")}</option>
          </select>
          {scope === "clock" && <span className="mt-1 block text-xs text-stone-500">{t("abs.flow.scope.clockHint")}</span>}
        </label>
        <label className="flex items-center gap-2 text-sm text-stone-700">
          <input type="checkbox" checked={isDefault} onChange={(e) => setDefault(e.target.checked)} />
          {t("abs.flow.default")}
        </label>
        {levels.map((l, i) => (
          <fieldset key={i} className="space-y-2 rounded-md border border-stone-200 p-3">
            <legend className="px-1 text-xs font-semibold text-stone-600">{t("abs.flow.level", { n: i + 1 })}</legend>
            <label className="flex items-center gap-2 text-sm text-stone-700">
              <input
                type="checkbox"
                checked={l.roles.includes("managers")}
                onChange={(e) => setLevel(i, { ...l, roles: e.target.checked ? [...l.roles, "managers"] : l.roles.filter((r) => r !== "managers") })}
              />
              {t("abs.flow.managers")}
            </label>
            <label className="block">
              <span className={LABEL}>{t("abs.flow.profiles")}</span>
              <select
                multiple
                aria-label={`${t("abs.flow.profiles")} ${i + 1}`}
                className={`${FIELD} w-full`}
                value={l.roles.filter((r) => r.startsWith("profile:")).map((r) => r.slice(8))}
                onChange={(e) => setLevel(i, { ...l, roles: [...l.roles.filter((r) => r === "managers"), ...multi(e).map((id) => `profile:${id}`)] })}
              >
                {(profiles.data ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className={LABEL}>{t("abs.flow.people")}</span>
              <select multiple aria-label={`${t("abs.flow.people")} ${i + 1}`} className={`${FIELD} w-full`} value={l.people} onChange={(e) => setLevel(i, { ...l, people: multi(e) })}>
                {(users.data ?? []).map((u) => (
                  <option key={u.userId} value={u.userId}>
                    {u.label}
                  </option>
                ))}
              </select>
            </label>
            {levels.length > 1 && (
              <Button size="sm" variant="tertiary" icon={<IconClose />} onClick={() => setLevels(levels.filter((_, j) => j !== i))}>
                {t("abs.flow.removeLevel", { n: i + 1 })}
              </Button>
            )}
          </fieldset>
        ))}
        {levels.length < 5 && (
          <Button size="sm" icon={<IconPlus />} onClick={() => setLevels([...levels, { people: [], roles: [] }])}>
            {t("abs.flow.addLevel")}
          </Button>
        )}
        {problems.map((n) => (
          <p key={n} className="text-sm text-red-700">
            {t("abs.flow.emptyLevel", { n })}
          </p>
        ))}
        <label className="block">
          <span className={LABEL}>{t("abs.flow.fallback")}</span>
          <select multiple aria-label={t("abs.flow.fallback")} className={`${FIELD} w-full`} value={fallback} onChange={(e) => setFallback(multi(e))}>
            {(users.data ?? []).map((u) => (
              <option key={u.userId} value={u.userId}>
                {u.label}
              </option>
            ))}
          </select>
        </label>
        {save.isError && <p className="text-sm text-red-700">{message(save.error, t("common.error"))}</p>}
      </div>
    </Drawer>
  );
}
