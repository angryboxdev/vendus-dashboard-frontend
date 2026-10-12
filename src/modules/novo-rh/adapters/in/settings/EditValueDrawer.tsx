import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useI18n } from "../../../../../i18n/I18nProvider.tsx";
import { AlertBanner, Button, Drawer, FIELD, LABEL } from "../../../../../components/ui/index.ts";
import type { SettingData, SettingDefinition } from "../../../domain/entities/settings.ts";
import { parseSettingInput, todayIn } from "../../../domain/services/settings-format.service.ts";
import { useNovoRh } from "../../../novo-rh.module.tsx";

const initialText = (v: SettingData | null, def: SettingDefinition): string => {
  const value = v ?? def.defaultValue;
  if (value === null) return def.type === "bool" ? "false" : "";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
};

/**
 * Alterar um parâmetro num perfil: valor, data de efeito e motivo. Data
 * passada → mostra o impacto antes de guardar (TK-6); dependência em falta
 * → a mensagem do servidor (TK-7) aparece no painel.
 */
export function EditValueDrawer({
  profileId,
  etag,
  definition: def,
  current,
  onClose,
}: {
  profileId: string;
  etag: string | null;
  definition: SettingDefinition;
  current: SettingData | null;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const { settings } = useNovoRh();
  const qc = useQueryClient();
  const today = todayIn();
  const [text, setText] = useState(() => initialText(current, def));
  const [unset, setUnset] = useState(false);
  const [validFrom, setValidFrom] = useState(today);
  const [reason, setReason] = useState("");
  const retro = /^\d{4}-\d{2}-\d{2}$/.test(validFrom) && validFrom < today;

  const impact = useQuery({
    queryKey: ["novo-rh", "settings", "impact", profileId, validFrom],
    queryFn: () => settings.impactPreview(profileId, validFrom),
    enabled: retro,
  });

  const parsed = unset ? null : parseSettingInput(def, text);
  const invalid = !unset && parsed === null;

  const save = useMutation({
    mutationFn: () => settings.setValue(profileId, etag, { key: def.key, value: parsed, validFrom, reason }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["novo-rh", "settings"] });
      onClose();
    },
  });

  const input = (() => {
    const common = { id: "setting-value", className: `${FIELD} w-full`, disabled: unset };
    switch (def.type) {
      case "bool":
        return (
          <select {...common} value={text} onChange={(e) => setText(e.target.value)}>
            <option value="true">{t("common.yes")}</option>
            <option value="false">{t("common.no")}</option>
          </select>
        );
      case "enum":
        return (
          <select {...common} value={text} onChange={(e) => setText(e.target.value)}>
            {(def.allowed ?? []).map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        );
      case "int":
      case "duration":
        return <input {...common} type="number" min={def.min} max={def.max} value={text} onChange={(e) => setText(e.target.value)} />;
      case "time":
        return <input {...common} type="time" value={text} onChange={(e) => setText(e.target.value)} />;
      case "json":
        return <textarea {...common} rows={4} value={text} onChange={(e) => setText(e.target.value)} />;
      default:
        return <input {...common} type="text" value={text} onChange={(e) => setText(e.target.value)} />;
    }
  })();

  return (
    <Drawer
      open
      as="form"
      title={t("settings.edit.title", { label: def.label })}
      description={def.description}
      onClose={onClose}
      onSubmit={(e) => {
        e.preventDefault();
        if (!invalid && reason.trim()) save.mutate();
      }}
      footer={
        <div className="flex justify-end gap-2">
          <Button type="button" variant="tertiary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" variant="primary" disabled={invalid || !reason.trim() || save.isPending}>
            {t("common.save")}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <label htmlFor="setting-value" className={LABEL}>
            {t("settings.edit.value")}
            {def.unit === "minutes" ? " (min)" : ""}
          </label>
          {input}
          {invalid && <p className="mt-1 text-xs text-red-700">{t("settings.edit.invalid")}</p>}
          <label className="mt-2 flex items-center gap-2 text-sm text-stone-600">
            <input type="checkbox" checked={unset} onChange={(e) => setUnset(e.target.checked)} />
            {t("settings.edit.unset")}
          </label>
        </div>
        <div>
          <label htmlFor="setting-valid-from" className={LABEL}>
            {t("settings.edit.validFrom")}
          </label>
          <input id="setting-valid-from" type="date" className={`${FIELD} w-full`} value={validFrom} onChange={(e) => setValidFrom(e.target.value)} />
        </div>
        {retro && impact.data && (
          <AlertBanner tone="warning" title={t("settings.edit.retroTitle")}>
            {t("settings.edit.retroBody", { employees: impact.data.employees, days: impact.data.pastDays })}
          </AlertBanner>
        )}
        <div>
          <label htmlFor="setting-reason" className={LABEL}>
            {t("settings.edit.reason")}
          </label>
          <textarea id="setting-reason" rows={3} className={`${FIELD} w-full`} value={reason} onChange={(e) => setReason(e.target.value)} />
          <p className="mt-1 text-xs text-stone-500">{t("settings.edit.reasonHint")}</p>
        </div>
        {(save.isError || impact.isError) && (
          <AlertBanner tone="danger" title={t("common.loadError")}>
            {(save.error ?? impact.error) instanceof Error ? (save.error ?? impact.error)!.message : ""}
          </AlertBanner>
        )}
      </div>
    </Drawer>
  );
}
