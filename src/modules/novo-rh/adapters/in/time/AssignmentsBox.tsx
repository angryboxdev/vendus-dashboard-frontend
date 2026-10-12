import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useI18n } from "../../../../../i18n/I18nProvider.tsx";
import { AlertBanner, Button, FIELD, IconPlus } from "../../../../../components/ui/index.ts";
import type { TimeResource, TimeTarget } from "../../../domain/entities/time.ts";
import { todayIn } from "../../../domain/services/settings-format.service.ts";
import { useNovoRh } from "../../../novo-rh.module.tsx";

/** A quem se aplica um horário/calendário, com data — acrescentar e terminar. */
export function AssignmentsBox({ resourceType, resourceId }: { resourceType: TimeResource; resourceId: string }) {
  const { t } = useI18n();
  const { time, settings, structure } = useNovoRh();
  const qc = useQueryClient();
  const [targetType, setTargetType] = useState<TimeTarget>("location");
  const [targetId, setTargetId] = useState("");
  const [validFrom, setValidFrom] = useState(todayIn());
  const all = useQuery({ queryKey: ["novo-rh", "time", "assignments"], queryFn: () => time.listAssignments() });
  const locations = useQuery({ queryKey: ["novo-rh", "settings", "locations"], queryFn: () => settings.listLocations() });
  const employees = useQuery({ queryKey: ["novo-rh", "settings", "employees"], queryFn: () => settings.listEmployees() });
  const deps = useQuery({ queryKey: ["novo-rh", "structure", "departments"], queryFn: () => structure.listDepartments() });
  const groups = useQuery({ queryKey: ["novo-rh", "structure", "groups"], queryFn: () => structure.listGroups() });
  const options: Record<TimeTarget, { id: string; label: string }[]> = {
    location: locations.data ?? [],
    employee: employees.data ?? [],
    department: (deps.data ?? []).filter((d) => !d.archived).map((d) => ({ id: d.id, label: d.name })),
    group: (groups.data ?? []).filter((g) => !g.archived).map((g) => ({ id: g.id, label: g.name })),
  };
  const label = (type: TimeTarget, id: string) => options[type].find((o) => o.id === id)?.label ?? id;
  const refresh = () => void qc.invalidateQueries({ queryKey: ["novo-rh", "time"] });
  const add = useMutation({ mutationFn: () => time.assign({ resourceType, resourceId, targetType, targetId, validFrom, validTo: null }), onSuccess: () => (setTargetId(""), refresh()) });
  const end = useMutation({ mutationFn: (id: string) => time.endAssignment(id, todayIn()), onSuccess: refresh });
  const mine = (all.data ?? []).filter((a) => a.resourceType === resourceType && a.resourceId === resourceId);

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">{t("time.assignments")}</p>
      {mine.length === 0 ? (
        <p className="text-sm text-stone-500">{t("time.assignments.empty")}</p>
      ) : (
        <ul className="text-sm text-stone-700">
          {mine.map((a) => (
            <li key={a.id} className="flex items-center justify-between py-1">
              <span>
                {t(`settings.target.${a.targetType}`)}: {label(a.targetType, a.targetId)} · {a.validFrom}
                {a.validTo ? ` → ${a.validTo}` : ""}
              </span>
              {!a.validTo && (
                <Button size="sm" variant="tertiary" onClick={() => end.mutate(a.id)}>
                  {t("common.end")}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="grid gap-2 sm:grid-cols-[130px_1fr_150px_auto]">
        <select aria-label={t("time.assign.target")} className={FIELD} value={targetType} onChange={(e) => (setTargetType(e.target.value as TimeTarget), setTargetId(""))}>
          {(["location", "department", "group", "employee"] as const).map((k) => (
            <option key={k} value={k}>
              {t(`settings.target.${k}`)}
            </option>
          ))}
        </select>
        <select aria-label={t("settings.target.who")} className={FIELD} value={targetId} onChange={(e) => setTargetId(e.target.value)}>
          <option value="">{t("common.choose")}</option>
          {options[targetType].map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
        <input aria-label={t("common.from")} type="date" className={FIELD} value={validFrom} onChange={(e) => setValidFrom(e.target.value)} />
        <Button size="sm" icon={<IconPlus />} disabled={!targetId || add.isPending} onClick={() => add.mutate()}>
          {t("time.assign")}
        </Button>
      </div>
      {(add.isError || end.isError) && (
        <AlertBanner tone="danger" title={t("common.error")}>
          {(add.error ?? end.error) instanceof Error ? (add.error ?? end.error)!.message : ""}
        </AlertBanner>
      )}
    </div>
  );
}
