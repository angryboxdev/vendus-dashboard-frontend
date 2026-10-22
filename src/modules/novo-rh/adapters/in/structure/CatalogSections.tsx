import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useI18n } from "../../../../../i18n/I18nProvider.tsx";
import { AlertBanner, Button, Dialog, FIELD, IconPlus, LABEL, SECTION_TITLE, StatusBadge, SURFACE, TABLE, TD, TH, THEAD, TR } from "../../../../../components/ui/index.ts";
import type { CompensationItem, CustomFieldDefinition, PositionDetail } from "../../../domain/entities/people.ts";
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

/**
 * Cargos (o que cada pessoa faz; ≠ perfil de acesso): criar, editar e
 * ativar/desativar. Um cargo desativado deixa de aparecer nas escolhas, mas
 * quem já o tem mantém-no. Antes só existia no RH antigo.
 */
function Positions() {
  const { people } = useNovoRh();
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: "", description: "" });
  const [editing, setEditing] = useState<PositionDetail | null>(null);
  const [draft, setDraft] = useState({ name: "", description: "" });
  const [showInactive, setShowInactive] = useState(false);
  const q = useQuery({ queryKey: [...KEY, "positions", "detail"], queryFn: () => people.listPositionDetails(), retry: false });
  // A lista simples (fichas, escalas, organograma) também se atualiza.
  const refresh = () => void qc.invalidateQueries({ queryKey: [...KEY, "positions"] });
  const create = useMutation({
    mutationFn: () => people.createPosition({ name: form.name.trim(), description: form.description.trim() || null }),
    onSuccess: () => (setForm({ name: "", description: "" }), refresh()),
  });
  const update = useMutation({
    mutationFn: () => people.updatePosition(editing!.id, { name: draft.name.trim(), description: draft.description.trim() || null }),
    onSuccess: () => (setEditing(null), refresh()),
  });
  const toggle = useMutation({ mutationFn: (p: PositionDetail) => people.setPositionActive(p.id, !p.active), onSuccess: refresh });
  const all = q.data ?? [];
  const shown = all.filter((p) => showInactive || p.active).sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name, "pt"));
  const inactive = all.filter((p) => !p.active).length;
  const openEdit = (p: PositionDetail) => (update.reset(), setDraft({ name: p.name, description: p.description ?? "" }), setEditing(p));

  return (
    <section className={`${SURFACE} space-y-3 p-4`} aria-labelledby="cat-positions">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id="cat-positions" className={SECTION_TITLE}>
          Cargos
        </h3>
        {inactive > 0 && (
          <label className="flex items-center gap-2 text-xs text-stone-600">
            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
            Mostrar desativados ({inactive})
          </label>
        )}
      </div>
      <p className="text-xs text-stone-500">O que cada pessoa faz (ex.: Gerente de loja). Não dá acessos — esses são os perfis em Utilizadores.</p>
      {q.isError ? (
        <p className="text-sm text-stone-500">Sem permissão para gerir cargos (perfil de acesso «Cargos»).</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <input aria-label="Nome do cargo" placeholder="Nome do cargo (ex.: Gerente de loja)" className={`${FIELD} min-w-48 flex-1`} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input aria-label="Descrição do cargo" placeholder="Descrição (opcional)" className={`${FIELD} min-w-48 flex-[2]`} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <Button variant="primary" icon={<IconPlus />} disabled={!form.name.trim() || create.isPending} onClick={() => create.mutate()}>
              Adicionar
            </Button>
          </div>
          {q.isLoading ? (
            <p className="text-sm text-stone-400">A carregar…</p>
          ) : shown.length === 0 ? (
            <p className="text-sm text-stone-500">Ainda não há cargos.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className={TABLE}>
                <thead className={THEAD}>
                  <tr>
                    <th className={TH}>Cargo</th>
                    <th className={TH}>Descrição</th>
                    <th className={`${TH} text-right`}>Colaboradores</th>
                    <th className={TH}>Estado</th>
                    <th className={TH}>
                      <span className="sr-only">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((p) => (
                    <tr key={p.id} className={TR}>
                      <td className={`${TD} font-medium`}>{p.name}</td>
                      <td className={`${TD} text-stone-600`}>{p.description ?? "—"}</td>
                      <td className={`${TD} text-right tabular-nums`}>{p.employeeCount}</td>
                      <td className={TD}>{p.active ? <StatusBadge tone="success">Ativo</StatusBadge> : <StatusBadge tone="neutral">Desativado</StatusBadge>}</td>
                      <td className={`${TD} whitespace-nowrap text-right`}>
                        <Button size="sm" variant="tertiary" onClick={() => openEdit(p)}>
                          Editar
                        </Button>
                        <Button size="sm" variant="tertiary" disabled={toggle.isPending} onClick={() => toggle.mutate(p)}>
                          {p.active ? "Desativar" : "Ativar"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
      <Err error={create.error ?? toggle.error} />
      <Dialog
        open={editing !== null}
        title="Editar cargo"
        description={editing && editing.employeeCount > 0 ? `${editing.employeeCount} colaborador(es) têm este cargo; o nome muda para todos.` : undefined}
        onClose={() => setEditing(null)}
        actions={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button variant="primary" disabled={!draft.name.trim() || update.isPending} onClick={() => update.mutate()}>
              Guardar
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <label className="block">
            <span className={LABEL}>Nome</span>
            <input className={`${FIELD} w-full`} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </label>
          <label className="block">
            <span className={LABEL}>Descrição</span>
            <input className={`${FIELD} w-full`} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
          </label>
          <Err error={update.error} />
        </div>
      </Dialog>
    </section>
  );
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

/** Estrutura → Catálogos (Fase 2): cargos, convénios, complementos/benefícios, campos personalizados. */
export function CatalogSections() {
  const { t } = useI18n();
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">{t("catalog.title")}</h2>
      <Positions />
      <div className="grid gap-4 lg:grid-cols-2">
        <Agreements />
        <Fields />
      </div>
      <Items />
    </div>
  );
}
