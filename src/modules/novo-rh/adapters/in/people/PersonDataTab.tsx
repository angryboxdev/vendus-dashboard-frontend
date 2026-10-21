import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useI18n } from "../../../../../i18n/I18nProvider.tsx";
import type { MessageKey } from "../../../../../i18n/i18n.ts";
import { AlertBanner, AppIcon, Button, FIELD, LABEL, SURFACE, type AppIconKey } from "../../../../../components/ui/index.ts";
import type { VersionedPerson } from "../../../domain/entities/people.ts";
import type { Option } from "../../../domain/ports/out/settings-api.port.ts";
import { changedFields, draftOf, MANDATORY, needsReason, PERSON_SECTIONS, type PersonDraft } from "../../../domain/services/people-form.service.ts";
import { useNovoRh } from "../../../novo-rh.module.tsx";
import { PersonFieldInput, SPECIAL_FIELDS } from "./PersonFieldInput.tsx";

type SectionKey = (typeof PERSON_SECTIONS)[number]["key"];
const SECTION_ICON: Record<SectionKey, AppIconKey> = { identity: "identity", contact: "contact", address: "address", work: "work", pay: "pay" };
/** Campos que ocupam a linha toda na grelha de duas colunas. */
const WIDE = new Set(["address"]);

/**
 * Separador Dados: um só formulário contínuo com as secções do domínio
 * (`PERSON_SECTIONS`) e um menu lateral de âncoras. Sem permissão → "Sem
 * permissão"; sensíveis pedem motivo. A gravação é a mesma de sempre
 * (`people.update` com os campos alterados); mudar de secção nunca mexe no rascunho.
 */
export function PersonDataTab({ data, locations, onDirtyChange }: { data: VersionedPerson; locations: Option[]; onDirtyChange?: (dirty: boolean) => void }) {
  const { t } = useI18n();
  const { people } = useNovoRh();
  const qc = useQueryClient();
  const p = data.person;
  const [draft, setDraft] = useState<PersonDraft>(() => draftOf(p));
  const [reason, setReason] = useState("");
  const [current, setCurrent] = useState<SectionKey>("identity");
  const refs = useRef<Partial<Record<SectionKey, HTMLElement | null>>>({});
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

  useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange]);
  // Fechar ou recarregar a página com alterações por guardar pede confirmação ao navegador.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  // A secção visível fica destacada no menu.
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        const top = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (top) setCurrent(top.target.getAttribute("data-section") as SectionKey);
      },
      { rootMargin: "-15% 0px -60% 0px" },
    );
    for (const el of Object.values(refs.current)) if (el) io.observe(el);
    return () => io.disconnect();
  }, []);

  const goTo = (key: SectionKey) => {
    setCurrent(key);
    refs.current[key]?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  };

  return (
    <form
      className="grid gap-4 lg:grid-cols-[200px_minmax(0,1fr)] xl:grid-cols-[220px_minmax(0,1fr)]"
      onSubmit={(e) => {
        e.preventDefault();
        if (dirty && (!reasonNeeded || reason.trim())) save.mutate();
      }}
    >
      {/* Mobile/tablet estreito: seletor compacto; desktop: menu lateral fixo. */}
      <div className="lg:hidden">
        <label htmlFor="person-section" className="sr-only">
          {t("people.dataNav.select")}
        </label>
        <select id="person-section" className={`${FIELD} w-full`} value={current} onChange={(e) => goTo(e.target.value as SectionKey)}>
          {PERSON_SECTIONS.map((s) => (
            <option key={s.key} value={s.key}>
              {t(`people.section.${s.key}` as MessageKey)}
            </option>
          ))}
        </select>
      </div>
      <nav aria-label={t("people.dataNav")} className="hidden lg:block">
        <ul className="sticky top-4 space-y-1">
          {PERSON_SECTIONS.map((s) => {
            const active = current === s.key;
            return (
              <li key={s.key}>
                <button
                  type="button"
                  aria-current={active ? "true" : undefined}
                  onClick={() => goTo(s.key)}
                  className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm transition-colors duration-150 ${
                    active ? "bg-brand-50 font-medium text-brand-600" : "text-ink-secondary hover:bg-surface-soft hover:text-ink"
                  }`}
                >
                  <AppIcon name={SECTION_ICON[s.key]} size={18} />
                  {t(`people.section.${s.key}` as MessageKey)}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className={`${SURFACE} min-w-0`}>
        {PERSON_SECTIONS.map((section, i) => (
          <section
            key={section.key}
            ref={(el) => {
              refs.current[section.key] = el;
            }}
            data-section={section.key}
            aria-labelledby={`sec-${section.key}`}
            className={`scroll-mt-4 px-4 py-5 sm:px-6 ${i > 0 ? "border-t border-line-subtle" : ""}`}
          >
            <h2 id={`sec-${section.key}`} className="mb-4 text-base font-semibold text-navy-900">
              {t(`people.section.${section.key}` as MessageKey)}
            </h2>
            <div className="grid gap-x-5 gap-y-4 md:grid-cols-2">
              {section.fields.map(({ field, type }) => {
                const id = `person-${field}`;
                const label = t(`people.field.${field}` as MessageKey);
                const hidden = p.hidden.includes(field);
                const missing = p.missing.includes(field);
                return (
                  <div key={field} className={WIDE.has(field) ? "md:col-span-2" : undefined}>
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
                    ) : SPECIAL_FIELDS.has(field) ? (
                      <PersonFieldInput field={field} id={id} value={draft[field] ?? ""} invalid={missing} onChange={(v) => setDraft({ ...draft, [field]: v })} />
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
            </div>
          </section>
        ))}

        {reasonNeeded && (
          <div className="border-t border-line-subtle px-4 py-4 sm:px-6">
            <label htmlFor="person-reason" className={LABEL}>
              {t("people.reason")}
            </label>
            <input id="person-reason" className={`${FIELD} w-full`} value={reason} onChange={(e) => setReason(e.target.value)} />
            <p className="mt-1 text-xs text-stone-500">{t("people.reasonHint")}</p>
          </div>
        )}
        {(save.isError || (save.isSuccess && !dirty)) && (
          <div className="px-4 pb-4 sm:px-6">
            {save.isError ? (
              <AlertBanner tone="danger" title={t("common.error")}>
                {save.error instanceof Error ? save.error.message : ""}
              </AlertBanner>
            ) : (
              <AlertBanner tone="success" title={t("people.saved")}>
                {""}
              </AlertBanner>
            )}
          </div>
        )}

        {/* Barra de gravação: acompanha o scroll no fim do cartão, depois dos campos (nunca os tapa). */}
        <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-end gap-3 rounded-b-2xl border-t border-line-subtle bg-surface-card/95 px-4 py-3 backdrop-blur sm:px-6">
          {dirty && (
            <p role="status" className="mr-auto text-sm text-amber-700">
              {t("people.unsaved")}
            </p>
          )}
          {dirty && (
            <Button variant="tertiary" disabled={save.isPending} onClick={() => (setDraft(draftOf(p)), setReason(""))}>
              {t("people.discard")}
            </Button>
          )}
          <Button type="submit" variant="primary" disabled={!dirty || (reasonNeeded && !reason.trim()) || save.isPending}>
            {save.isPending ? t("people.saving") : t("people.saveChanges")}
          </Button>
        </div>
      </div>
    </form>
  );
}
