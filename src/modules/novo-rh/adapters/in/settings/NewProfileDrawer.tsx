import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useI18n } from "../../../../../i18n/I18nProvider.tsx";
import { AlertBanner, Button, Drawer, FIELD, LABEL } from "../../../../../components/ui/index.ts";
import type { ProfileKind, SettingDomain } from "../../../domain/entities/settings.ts";
import { useNovoRh } from "../../../novo-rh.module.tsx";

export function NewProfileDrawer({ open, domain, onClose, onCreated }: { open: boolean; domain: SettingDomain; onClose: () => void; onCreated: (id: string) => void }) {
  const { t } = useI18n();
  const { settings } = useNovoRh();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<ProfileKind>("global");
  const create = useMutation({
    mutationFn: () => settings.createProfile({ domain, name, kind }),
    onSuccess: (p) => {
      void qc.invalidateQueries({ queryKey: ["novo-rh", "settings", "profiles"] });
      setName("");
      onCreated(p.id);
    },
  });

  return (
    <Drawer
      open={open}
      as="form"
      title={t("settings.profiles.new")}
      onClose={onClose}
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim()) create.mutate();
      }}
      footer={
        <div className="flex justify-end gap-2">
          <Button type="button" variant="tertiary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" variant="primary" disabled={!name.trim() || create.isPending}>
            {t("common.save")}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <label htmlFor="profile-name" className={LABEL}>
            {t("settings.profiles.name")}
          </label>
          <input id="profile-name" className={`${FIELD} w-full`} maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label htmlFor="profile-kind" className={LABEL}>
            {t("settings.profiles.kind")}
          </label>
          <select id="profile-kind" className={`${FIELD} w-full`} value={kind} onChange={(e) => setKind(e.target.value as ProfileKind)}>
            <option value="global">{t("settings.kind.global")}</option>
            <option value="segment">{t("settings.kind.segment")}</option>
            <option value="personal">{t("settings.kind.personal")}</option>
          </select>
        </div>
        {create.isError && (
          <AlertBanner tone="danger" title={t("common.loadError")}>
            {create.error instanceof Error ? create.error.message : ""}
          </AlertBanner>
        )}
      </div>
    </Drawer>
  );
}
