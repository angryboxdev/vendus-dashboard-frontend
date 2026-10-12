import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useI18n } from "../../../../../i18n/I18nProvider.tsx";
import { AlertBanner, Button, Drawer, FIELD, LABEL } from "../../../../../components/ui/index.ts";
import type { ProfileKind, TargetType } from "../../../domain/entities/settings.ts";
import type { Option } from "../../../domain/ports/out/settings-api.port.ts";
import { todayIn } from "../../../domain/services/settings-format.service.ts";
import { useNovoRh } from "../../../novo-rh.module.tsx";

export function AddTargetDrawer({
  profileId,
  etag,
  kind,
  employees,
  locations,
  onClose,
}: {
  profileId: string;
  etag: string | null;
  kind: ProfileKind;
  employees: Option[];
  locations: Option[];
  onClose: () => void;
}) {
  const { t } = useI18n();
  const { settings } = useNovoRh();
  const qc = useQueryClient();
  const [targetType, setTargetType] = useState<TargetType>(kind === "personal" ? "employee" : "location");
  const [targetId, setTargetId] = useState("");
  const [validFrom, setValidFrom] = useState(todayIn());
  const [validTo, setValidTo] = useState("");
  const options = targetType === "employee" ? employees : targetType === "location" ? locations : [];

  const add = useMutation({
    mutationFn: () => settings.addTarget(profileId, etag, { targetType, targetId, validFrom, validTo: validTo || null }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["novo-rh", "settings", "profile", profileId] });
      onClose();
    },
  });

  return (
    <Drawer
      open
      as="form"
      title={t("settings.profile.addTarget")}
      onClose={onClose}
      onSubmit={(e) => {
        e.preventDefault();
        if (targetId) add.mutate();
      }}
      footer={
        <div className="flex justify-end gap-2">
          <Button type="button" variant="tertiary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" variant="primary" disabled={!targetId || add.isPending}>
            {t("common.save")}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {kind === "segment" && (
          <div>
            <label htmlFor="target-type" className={LABEL}>
              {t("settings.target.type")}
            </label>
            <select
              id="target-type"
              className={`${FIELD} w-full`}
              value={targetType}
              onChange={(e) => {
                setTargetType(e.target.value as TargetType);
                setTargetId("");
              }}
            >
              <option value="location">{t("settings.target.location")}</option>
              <option value="department" disabled>
                {t("settings.target.department")}
              </option>
              <option value="group" disabled>
                {t("settings.target.group")}
              </option>
            </select>
            <p className="mt-1 text-xs text-stone-500">{t("settings.target.unavailable")}</p>
          </div>
        )}
        <div>
          <label htmlFor="target-who" className={LABEL}>
            {t("settings.target.who")}
          </label>
          <select id="target-who" className={`${FIELD} w-full`} value={targetId} onChange={(e) => setTargetId(e.target.value)}>
            <option value="">{t("common.choose")}</option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="target-from" className={LABEL}>
              {t("settings.target.validFrom")}
            </label>
            <input id="target-from" type="date" className={`${FIELD} w-full`} value={validFrom} onChange={(e) => setValidFrom(e.target.value)} />
          </div>
          <div>
            <label htmlFor="target-to" className={LABEL}>
              {t("settings.target.validTo")}
            </label>
            <input id="target-to" type="date" className={`${FIELD} w-full`} value={validTo} onChange={(e) => setValidTo(e.target.value)} />
          </div>
        </div>
        {add.isError && (
          <AlertBanner tone="danger" title={t("common.loadError")}>
            {add.error instanceof Error ? add.error.message : ""}
          </AlertBanner>
        )}
      </div>
    </Drawer>
  );
}
