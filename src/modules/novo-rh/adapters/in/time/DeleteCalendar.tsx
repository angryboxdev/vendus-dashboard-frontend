import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useI18n } from "../../../../../i18n/I18nProvider.tsx";
import { AlertBanner, Button, FIELD, LABEL } from "../../../../../components/ui/index.ts";
import { useNovoRh } from "../../../novo-rh.module.tsx";

/** RE-35: mostra os dias e colaboradores afetados e só elimina depois de escrever o nome. */
export function DeleteCalendar({ type, id }: { type: "holiday" | "vacation"; id: string }) {
  const { t } = useI18n();
  const { time } = useNovoRh();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const preview = useQuery({ queryKey: ["novo-rh", "time", "delete-preview", type, id], queryFn: () => time.deletePreview(type, id), enabled: open });
  const del = useMutation({ mutationFn: () => time.deleteCalendar(type, id, name), onSuccess: () => void qc.invalidateQueries({ queryKey: ["novo-rh", "time"] }) });

  if (!open)
    return (
      <Button size="sm" variant="danger" onClick={() => setOpen(true)}>
        {t("time.delete")}
      </Button>
    );
  return (
    <div className="space-y-2 rounded-lg border border-red-200 bg-red-50/40 p-3">
      {preview.data && (
        <AlertBanner tone="danger" title={t("time.delete")}>
          {t("time.delete.impact", { name: preview.data.name, days: preview.data.days, employees: preview.data.employees, assignments: preview.data.assignments })}
        </AlertBanner>
      )}
      <label htmlFor={`del-${id}`} className={LABEL}>
        {t("time.delete.confirmLabel")}
      </label>
      <input id={`del-${id}`} className={`${FIELD} w-full`} value={name} onChange={(e) => setName(e.target.value)} />
      <div className="flex gap-2">
        <Button size="sm" variant="tertiary" onClick={() => (setOpen(false), setName(""))}>
          {t("common.cancel")}
        </Button>
        <Button size="sm" variant="danger" disabled={!preview.data || name.trim() !== preview.data.name || del.isPending} onClick={() => del.mutate()}>
          {t("time.delete")}
        </Button>
      </div>
      {del.isError && <p className="text-xs text-red-700">{del.error instanceof Error ? del.error.message : ""}</p>}
    </div>
  );
}
