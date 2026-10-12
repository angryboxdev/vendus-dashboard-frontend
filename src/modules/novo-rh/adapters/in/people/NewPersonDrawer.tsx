import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useI18n } from "../../../../../i18n/I18nProvider.tsx";
import type { MessageKey } from "../../../../../i18n/i18n.ts";
import { AlertBanner, Button, Drawer, FIELD, LABEL } from "../../../../../components/ui/index.ts";
import type { Option } from "../../../domain/ports/out/settings-api.port.ts";
import { useNovoRh } from "../../../novo-rh.module.tsx";

const FIELDS = ["firstName", "lastName", "nif", "hireDate", "email", "phone"] as const;

/** Criar colaborador com os obrigatórios do mínimo legal (D4): nome, apelido, NIF, admissão, centro. */
export function NewPersonDrawer({ open, onClose, locations }: { open: boolean; onClose: () => void; locations: Option[] }) {
  const { t } = useI18n();
  const { people } = useNovoRh();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [form, setForm] = useState<Record<string, string>>({});
  const create = useMutation({
    mutationFn: () => people.create(Object.fromEntries(Object.entries(form).filter(([, v]) => v.trim()))),
    onSuccess: (p) => {
      void qc.invalidateQueries({ queryKey: ["novo-rh", "people"] });
      setForm({});
      onClose();
      navigate(`/hr/novo/pessoas/${p.id}`);
    },
  });
  const required = ["firstName", "lastName", "nif", "hireDate", "primaryLocationId"];
  const ready = required.every((f) => (form[f] ?? "").trim());

  return (
    <Drawer
      open={open}
      as="form"
      title={t("people.new")}
      onClose={onClose}
      onSubmit={(e) => {
        e.preventDefault();
        if (ready) create.mutate();
      }}
      footer={
        <div className="flex justify-end gap-2">
          <Button type="button" variant="tertiary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" variant="primary" disabled={!ready || create.isPending}>
            {t("common.save")}
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        {FIELDS.map((f) => (
          <div key={f}>
            <label htmlFor={`new-${f}`} className={LABEL}>
              {t(`people.field.${f}` as MessageKey)}
              {required.includes(f) && <span className="text-[#C2410C]"> *</span>}
            </label>
            <input
              id={`new-${f}`}
              type={f === "hireDate" ? "date" : f === "email" ? "email" : "text"}
              className={`${FIELD} w-full`}
              value={form[f] ?? ""}
              onChange={(e) => setForm({ ...form, [f]: e.target.value })}
            />
          </div>
        ))}
        <div>
          <label htmlFor="new-primaryLocationId" className={LABEL}>
            {t("people.field.primaryLocationId")}
            <span className="text-[#C2410C]"> *</span>
          </label>
          <select id="new-primaryLocationId" className={`${FIELD} w-full`} value={form.primaryLocationId ?? ""} onChange={(e) => setForm({ ...form, primaryLocationId: e.target.value })}>
            <option value="">{t("common.choose")}</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
        </div>
        {create.isError && (
          <AlertBanner tone="danger" title={t("common.error")}>
            {create.error instanceof Error ? create.error.message : ""}
          </AlertBanner>
        )}
      </div>
    </Drawer>
  );
}
