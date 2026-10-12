import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useI18n } from "../../../../../i18n/I18nProvider.tsx";
import { AlertBanner, Button, FIELD, IconPlus, SECTION_TITLE, StatusBadge, SURFACE } from "../../../../../components/ui/index.ts";
import type { CompensationItem, CustomFieldDefinition } from "../../../domain/entities/people.ts";
import { useNovoRh } from "../../../novo-rh.module.tsx";

const KEY = ["novo-rh", "catalog"] as const;

function Err({ error }: { error: unknown }) {
  const { t } = useI18n();
  return error ? (
    <AlertBanner tone="danger" title={t("common.error")}>
      {error instanceof Error ? error.message : ""}
    </AlertBanner>
  ) : null;
}

function Agreements() {
  const { t } = useI18n();
  const { people } = useNovoRh();
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: "", code: "" });
  const q = useQuery({ queryKey: [...KEY, "agreements"], queryFn: () => people.listAgreements() });
  const refresh = () => void qc.invalidateQueries({ queryKey: [...KEY, "agreements"] });
  const create = useMutation({ mutationFn: () => people.createAgreement({ name: form.name, code: form.code || null }), onSuccess: () => (setForm({ name: "", code: "" }), refresh()) });
  const archive = useMutation({ mutationFn: (id: string) => people.archiveAgreement(id), onSuccess: refresh });
  return (
    <section className={`${SURFACE} space-y-2 p-4`} aria-labelledby="cat-agr">
      <h3 id="cat-agr" className={SECTION_TITLE}>
        {t("catalog.agreements")}
      </h3>
      <p className="text-xs text-stone-500">{t("catalog.agreements.hint")}</p>
      <div className="flex gap-2">
        <input aria-label={`${t("catalog.agreements")} — ${t("common.name")}`} placeholder={t("common.name")} className={`${FIELD} flex-1`} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input aria-label={t("catalog.code")} placeholder={t("catalog.code")} className={`${FIELD} w-28`} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
        <Button variant="primary" icon={<IconPlus />} disabled={!form.name.trim() || create.isPending} onClick={() => create.mutate()}>
          {t("common.add")}
        </Button>
      </div>
      <ul className="divide-y divide-[#F5C992]/40 text-sm">
        {(q.data ?? []).filter((a) => !a.archived).map((a) => (
          <li key={a.id} className="flex items-center justify-between py-1.5">
            <span>
              {a.name} {a.code && <span className="text-xs text-stone-400">{a.code}</span>}
            </span>
            <Button size="sm" variant="tertiary" onClick={() => archive.mutate(a.id)}>
              {t("common.archive")}
            </Button>
          </li>
        ))}
      </ul>
      <Err error={create.error ?? archive.error} />
    </section>
  );
}

function Items() {
  const { t } = useI18n();
  const { people } = useNovoRh();
  const qc = useQueryClient();
  const blank = { kind: "complement" as CompensationItem["kind"], name: "", mode: "fixed" as CompensationItem["mode"], amount: "", currency: "EUR", payPeriod: "monthly" as CompensationItem["payPeriod"] };
  const [form, setForm] = useState(blank);
  const q = useQuery({ queryKey: [...KEY, "items"], queryFn: () => people.listCompensationItems() });
  const refresh = () => void qc.invalidateQueries({ queryKey: [...KEY, "items"] });
  const create = useMutation({
    mutationFn: () =>
      people.createCompensationItem({ kind: form.kind, name: form.name, code: null, mode: form.mode, amount: Number(form.amount || 0), employeeAmount: null, currency: form.currency.toUpperCase(), payPeriod: form.payPeriod, everyNMonths: 1 }),
    onSuccess: () => (setForm(blank), refresh()),
  });
  const deactivate = useMutation({ mutationFn: (id: string) => people.deactivateCompensationItem(id), onSuccess: refresh });
  const modes = form.kind === "complement" ? (["fixed", "variable"] as const) : (["copayment", "employee", "services"] as const);
  return (
    <section className={`${SURFACE} space-y-2 p-4`} aria-labelledby="cat-items">
      <h3 id="cat-items" className={SECTION_TITLE}>
        {t("catalog.items")}
      </h3>
      <p className="text-xs text-stone-500">{t("catalog.items.hint")}</p>
      <div className="grid gap-2 sm:grid-cols-[130px_1fr_120px_100px_80px_auto]">
        <select aria-label={t("contracts.type")} className={FIELD} value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as CompensationItem["kind"], mode: e.target.value === "complement" ? "fixed" : "copayment" })}>
          <option value="complement">{t("catalog.items.kind.complement")}</option>
          <option value="benefit">{t("catalog.items.kind.benefit")}</option>
        </select>
        <input aria-label={`${t("catalog.items")} — ${t("common.name")}`} placeholder={t("common.name")} className={FIELD} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <select aria-label={t("catalog.items.mode")} className={FIELD} value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value as CompensationItem["mode"] })}>
          {modes.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <input aria-label={t("catalog.items.amount")} placeholder={t("catalog.items.amount")} type="number" step="0.01" className={FIELD} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
        <input aria-label={t("people.field.currency")} className={FIELD} maxLength={3} value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} />
        <Button variant="primary" icon={<IconPlus />} disabled={!form.name.trim() || create.isPending} onClick={() => create.mutate()}>
          {t("common.add")}
        </Button>
      </div>
      <ul className="divide-y divide-[#F5C992]/40 text-sm">
        {(q.data ?? []).filter((i) => i.active).map((i) => (
          <li key={i.id} className="flex items-center justify-between py-1.5">
            <span>
              {i.name} · {i.amount} {i.currency} <StatusBadge tone="neutral">{t(i.kind === "complement" ? "catalog.items.kind.complement" : "catalog.items.kind.benefit")}</StatusBadge>
            </span>
            <Button size="sm" variant="tertiary" onClick={() => deactivate.mutate(i.id)}>
              {t("catalog.deactivate")}
            </Button>
          </li>
        ))}
      </ul>
      <Err error={create.error ?? deactivate.error} />
    </section>
  );
}

function Fields() {
  const { t } = useI18n();
  const { people } = useNovoRh();
  const qc = useQueryClient();
  const blank = { section: "custom" as CustomFieldDefinition["section"], name: "", format: "text" as CustomFieldDefinition["format"], options: "", sensitive: false };
  const [form, setForm] = useState(blank);
  const q = useQuery({ queryKey: [...KEY, "fields"], queryFn: () => people.listCustomFields() });
  const refresh = () => void qc.invalidateQueries({ queryKey: [...KEY, "fields"] });
  const create = useMutation({
    mutationFn: () => people.createCustomField({ section: form.section, name: form.name, format: form.format, options: form.options.split(",").map((o) => o.trim()).filter(Boolean), sensitive: form.sensitive }),
    onSuccess: () => (setForm(blank), refresh()),
  });
  const archive = useMutation({ mutationFn: (id: string) => people.archiveCustomField(id), onSuccess: refresh });
  return (
    <section className={`${SURFACE} space-y-2 p-4`} aria-labelledby="cat-fields">
      <h3 id="cat-fields" className={SECTION_TITLE}>
        {t("catalog.fields")}
      </h3>
      <p className="text-xs text-stone-500">{t("catalog.fields.hint")}</p>
      <div className="grid gap-2 sm:grid-cols-[1fr_120px_1fr_auto_auto]">
        <input aria-label={`${t("catalog.fields")} — ${t("common.name")}`} placeholder={t("common.name")} className={FIELD} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <select aria-label={t("catalog.fields.format")} className={FIELD} value={form.format} onChange={(e) => setForm({ ...form, format: e.target.value as CustomFieldDefinition["format"] })}>
          <option value="text">Texto</option>
          <option value="options">Opções</option>
        </select>
        <input aria-label={t("catalog.fields.options")} placeholder={t("catalog.fields.options")} className={FIELD} disabled={form.format !== "options"} value={form.options} onChange={(e) => setForm({ ...form, options: e.target.value })} />
        <label className="flex items-center gap-1 text-sm text-stone-700">
          <input type="checkbox" checked={form.sensitive} onChange={(e) => setForm({ ...form, sensitive: e.target.checked })} />
          {t("catalog.fields.sensitive")}
        </label>
        <Button variant="primary" icon={<IconPlus />} disabled={!form.name.trim() || create.isPending} onClick={() => create.mutate()}>
          {t("common.add")}
        </Button>
      </div>
      <ul className="divide-y divide-[#F5C992]/40 text-sm">
        {(q.data ?? []).filter((f) => !f.archived).map((f) => (
          <li key={f.id} className="flex items-center justify-between py-1.5">
            <span>
              {f.name} {f.format === "options" && <span className="text-xs text-stone-400">({f.options.join(", ")})</span>} {f.sensitive && <StatusBadge tone="warning">{t("catalog.fields.sensitive")}</StatusBadge>}
            </span>
            <Button size="sm" variant="tertiary" onClick={() => archive.mutate(f.id)}>
              {t("common.archive")}
            </Button>
          </li>
        ))}
      </ul>
      <Err error={create.error ?? archive.error} />
    </section>
  );
}

/** Estrutura → Catálogos (Fase 2): convénios, complementos/benefícios, campos personalizados. */
export function CatalogSections() {
  const { t } = useI18n();
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">{t("catalog.title")}</h2>
      <div className="grid gap-4 lg:grid-cols-2">
        <Agreements />
        <Fields />
      </div>
      <Items />
    </div>
  );
}
