import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useI18n } from "../../../../../i18n/I18nProvider.tsx";
import { Button, IconPlus, SECTION_TITLE, StatusBadge, SURFACE } from "../../../../../components/ui/index.ts";
import type { SettingDefinition } from "../../../domain/entities/settings.ts";
import { formatSettingValue } from "../../../domain/services/settings-format.service.ts";
import { useNovoRh } from "../../../novo-rh.module.tsx";
import { AddTargetDrawer } from "./AddTargetDrawer.tsx";
import { EditValueDrawer } from "./EditValueDrawer.tsx";

export function ProfilePanel({ profileId, definitions }: { profileId: string; definitions: SettingDefinition[] }) {
  const { t } = useI18n();
  const { settings } = useNovoRh();
  const [editing, setEditing] = useState<SettingDefinition | null>(null);
  const [addingTarget, setAddingTarget] = useState(false);
  const q = useQuery({ queryKey: ["novo-rh", "settings", "profile", profileId], queryFn: () => settings.getProfile(profileId) });
  const options = useQuery({
    queryKey: ["novo-rh", "settings", "target-options"],
    queryFn: async () => ({ employees: await settings.listEmployees(), locations: await settings.listLocations() }),
    enabled: !!q.data && q.data.detail.profile.kind !== "global",
  });

  if (q.isLoading) return <p className="text-sm text-stone-400">{t("common.loading")}</p>;
  if (q.isError || !q.data) return <p className="text-sm text-red-700">{t("common.loadError")}</p>;
  const { detail, etag } = q.data;
  const words = { yes: t("common.yes"), no: t("common.no") };
  const byKey = new Map(detail.values.map((v) => [v.key, v]));
  const labelOf = (type: string, id: string) =>
    (type === "employee" ? options.data?.employees : type === "location" ? options.data?.locations : undefined)?.find((o) => o.id === id)?.label ?? id;

  return (
    <section className={`${SURFACE} p-4`} aria-labelledby="settings-profile-title">
      <h2 id="settings-profile-title" className="text-base font-semibold text-stone-900">
        {detail.profile.name}
      </h2>
      <p className="text-xs text-stone-500">{t(`settings.kind.${detail.profile.kind}`)}</p>

      <div className="mt-3">
        {detail.profile.kind === "global" ? (
          <p className="text-sm text-stone-600">{t("settings.profile.appliesToAll")}</p>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2">
              <h3 className={SECTION_TITLE}>{t("settings.profile.targets")}</h3>
              <Button size="sm" icon={<IconPlus />} onClick={() => setAddingTarget(true)}>
                {t("settings.profile.addTarget")}
              </Button>
            </div>
            {detail.targets.length === 0 ? (
              <p className="mt-1 text-sm text-stone-500">{t("settings.profile.noTargets")}</p>
            ) : (
              <ul className="mt-1 space-y-0.5 text-sm text-stone-700">
                {detail.targets.map((tg) => (
                  <li key={tg.id}>
                    {t(`settings.target.${tg.targetType}`)}: {labelOf(tg.targetType, tg.targetId)} · {tg.validFrom}
                    {tg.validTo ? ` → ${tg.validTo}` : ""}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      <ul className="mt-4 divide-y divide-[#F5C992]/40">
        {definitions.map((def) => {
          const own = byKey.get(def.key);
          const requires = def.requires?.map((r) => definitions.find((d) => d.key === r.key)?.label ?? r.key);
          return (
            <li key={def.key} className="flex flex-wrap items-start justify-between gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-stone-900">{def.label}</p>
                <p className="text-xs text-stone-500">{def.description}</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {def.toValidate && <StatusBadge tone="warning">{t("settings.param.toValidate")}</StatusBadge>}
                  {def.legal && <StatusBadge tone="neutral">{t("settings.param.legal")}</StatusBadge>}
                  {def.activeFromPhase && <StatusBadge tone="neutral">{t("settings.param.fromPhase", { phase: def.activeFromPhase })}</StatusBadge>}
                  {requires?.map((label) => (
                    <span key={label} className="text-xs text-stone-500">
                      {t("settings.param.requires", { label })}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-sm ${own && own.value !== null ? "font-semibold text-stone-900" : "text-stone-400"}`}>
                  {own && own.value !== null ? formatSettingValue(def, own.value, words) : t("settings.param.notSet")}
                </span>
                <Button size="sm" onClick={() => setEditing(def)} aria-label={`${t("settings.param.edit")} ${def.label}`}>
                  {t("settings.param.edit")}
                </Button>
              </div>
            </li>
          );
        })}
      </ul>

      {editing && (
        <EditValueDrawer
          profileId={profileId}
          etag={etag}
          definition={editing}
          current={byKey.get(editing.key)?.value ?? null}
          onClose={() => setEditing(null)}
        />
      )}
      {addingTarget && (
        <AddTargetDrawer
          profileId={profileId}
          etag={etag}
          kind={detail.profile.kind}
          employees={options.data?.employees ?? []}
          locations={options.data?.locations ?? []}
          onClose={() => setAddingTarget(false)}
        />
      )}
    </section>
  );
}
