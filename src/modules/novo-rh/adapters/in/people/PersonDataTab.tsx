import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useI18n } from "../../../../../i18n/I18nProvider.tsx";
import type { MessageKey } from "../../../../../i18n/i18n.ts";
import { AlertBanner, Button, FIELD, LABEL, SECTION_TITLE, SURFACE } from "../../../../../components/ui/index.ts";
import type { VersionedPerson } from "../../../domain/entities/people.ts";
import type { Option } from "../../../domain/ports/out/settings-api.port.ts";
import { changedFields, draftOf, MANDATORY, needsReason, PERSON_SECTIONS, type PersonDraft } from "../../../domain/services/people-form.service.ts";
import { useNovoRh } from "../../../novo-rh.module.tsx";

/** Separador Dados: campos por secção; sem permissão → "Sem permissão"; sensíveis pedem motivo. */
export function PersonDataTab({ data, locations }: { data: VersionedPerson; locations: Option[] }) {
  const { t } = useI18n();
  const { people } = useNovoRh();
  const qc = useQueryClient();
  const p = data.person;
  const [draft, setDraft] = useState<PersonDraft>(() => draftOf(p));
  const [reason, setReason] = useState("");
  const changes = changedFields(p, draft);
  const dirty = Object.keys(changes).length > 0;
  const reasonNeeded = needsReason(changes);
  const save = useMutation({
    mutationFn: () => people.update(p.id, data.etag, { ...changes, ...(reasonNeeded && { reason }) } as never),
    onSuccess: (next) => {
      qc.setQueryData(["novo-rh", "person", p.id], next);
      void qc.invalidateQueries({ queryKey: ["novo-rh", "people"] });
      setDraft(draftOf(next.person));
      setReason("");
    },
  });

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (dirty && (!reasonNeeded || reason.trim())) save.mutate();
      }}
    >
      <div className="grid gap-4 lg:grid-cols-2">
        {PERSON_SECTIONS.map((section) => (
          <section key={section.key} className={`${SURFACE} space-y-3 p-4`} aria-labelledby={`sec-${section.key}`}>
            <h2 id={`sec-${section.key}`} className={SECTION_TITLE}>
              {t(`people.section.${section.key}` as MessageKey)}
            </h2>
            {section.fields.map(({ field, type }) => {
              const id = `person-${field}`;
              const label = t(`people.field.${field}` as MessageKey);
              const hidden = p.hidden.includes(field);
              const missing = p.missing.includes(field);
              return (
                <div key={field}>
                  <label htmlFor={id} className={LABEL}>
                    {label}
                    {MANDATORY.includes(field) && <span className="text-[#C2410C]"> *</span>}
                  </label>
                  {hidden ? (
                    <p id={id} className="text-sm text-stone-400">
                      {t("people.hiddenValue")}
                    </p>
                  ) : type === "select" ? (
                    <>
                      <select id={id} className={`${FIELD} w-full`} value={draft[field] ?? ""} disabled={!!p.primaryLocationId} onChange={(e) => setDraft({ ...draft, [field]: e.target.value })}>
                        <option value="">{t("common.choose")}</option>
                        {locations.map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.label}
                          </option>
                        ))}
                      </select>
                      {p.primaryLocationId && <p className="mt-1 text-xs text-stone-500">{t("people.transferHint")}</p>}
                    </>
                  ) : (
                    <input
                      id={id}
                      type={type}
                      step={type === "number" ? "0.01" : undefined}
                      className={`${FIELD} w-full ${missing ? "border-amber-400" : ""}`}
                      value={draft[field] ?? ""}
                      onChange={(e) => setDraft({ ...draft, [field]: e.target.value })}
                    />
                  )}
                </div>
              );
            })}
          </section>
        ))}
      </div>
      {reasonNeeded && (
        <div className={`${SURFACE} p-4`}>
          <label htmlFor="person-reason" className={LABEL}>
            {t("people.reason")}
          </label>
          <input id="person-reason" className={`${FIELD} w-full`} value={reason} onChange={(e) => setReason(e.target.value)} />
          <p className="mt-1 text-xs text-stone-500">{t("people.reasonHint")}</p>
        </div>
      )}
      {save.isError && (
        <AlertBanner tone="danger" title={t("common.error")}>
          {save.error instanceof Error ? save.error.message : ""}
        </AlertBanner>
      )}
      {save.isSuccess && !dirty && (
        <AlertBanner tone="success" title={t("people.saved")}>
          {""}
        </AlertBanner>
      )}
      <div className="flex justify-end">
        <Button type="submit" variant="primary" disabled={!dirty || (reasonNeeded && !reason.trim()) || save.isPending}>
          {t("common.save")}
        </Button>
      </div>
    </form>
  );
}
