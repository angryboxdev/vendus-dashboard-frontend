import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useI18n } from "../../../../../i18n/I18nProvider.tsx";
import type { MessageKey } from "../../../../../i18n/i18n.ts";
import { AlertBanner, Button, FIELD, IconPlus, LABEL, SECTION_TITLE, StatusBadge, SURFACE, TABLE, TD, TH, THEAD, TR } from "../../../../../components/ui/index.ts";
import type { ContractInput, ManagerKind } from "../../../domain/entities/people.ts";
import type { Option } from "../../../domain/ports/out/settings-api.port.ts";
import { formatSettingValue, LEVEL_KEY, todayIn } from "../../../domain/services/settings-format.service.ts";
import { useNovoRh } from "../../../novo-rh.module.tsx";
import { useNovoRhSlots } from "../slots.ts";

function ErrorBox({ error }: { error: unknown }) {
  const { t } = useI18n();
  if (!error) return null;
  return (
    <AlertBanner tone="danger" title={t("common.error")}>
      {error instanceof Error ? error.message : ""}
    </AlertBanner>
  );
}

const CONTRACT_TYPES = ["permanent", "fixed_term", "temporary", "internship", "other"] as const;

export function ContractsTab({ personId }: { personId: string }) {
  const { t } = useI18n();
  const { people } = useNovoRh();
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ["novo-rh", "person", personId, "contracts"], queryFn: () => people.listContracts(personId) });
  const agreements = useQuery({ queryKey: ["novo-rh", "catalog", "agreements"], queryFn: () => people.listAgreements() });
  const empty: ContractInput = { contractType: "permanent", code: null, startDate: "", endDate: null, seniorityDate: null, probationEnd: null, weeklyHours: 40, fte: 1, agreementId: null, remote: false, comment: null };
  const [form, setForm] = useState<ContractInput>(empty);
  const [cancelReason, setCancelReason] = useState("");
  const refresh = () => void qc.invalidateQueries({ queryKey: ["novo-rh", "person", personId, "contracts"] });
  const create = useMutation({ mutationFn: () => people.createContract(personId, form), onSuccess: () => (setForm(empty), refresh()) });
  const cancel = useMutation({ mutationFn: (id: string) => people.cancelContract(personId, list.data!.find((c) => c.id === id)!, cancelReason), onSuccess: () => (setCancelReason(""), refresh()) });

  return (
    <div className="space-y-4">
      {(list.data ?? []).some((c) => c.status === "active") && (
        <input aria-label={`${t("contracts.cancel")} — ${t("people.reason")}`} placeholder={`${t("contracts.cancel")} — ${t("people.reason")}`} className={`${FIELD} w-full max-w-sm`} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
      )}
      <section className={`${SURFACE} overflow-x-auto`}>
        {(list.data ?? []).length === 0 ? (
          <p className="p-4 text-sm text-stone-500">{t("contracts.empty")}</p>
        ) : (
          <table className={TABLE}>
            <thead className={THEAD}>
              <tr>
                <th className={TH}>{t("contracts.type")}</th>
                <th className={TH}>{t("contracts.start")}</th>
                <th className={TH}>{t("common.to")}</th>
                <th className={TH}>{t("contracts.weeklyHours")}</th>
                <th className={TH}>{t("contracts.fte")}</th>
                <th className={TH}>
                  <span className="sr-only">{t("contracts.cancel")}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {list.data!.map((c) => (
                <tr key={c.id} className={TR}>
                  <td className={TD}>
                    {t(`contracts.type.${c.contractType}` as MessageKey)} {c.status === "cancelled" && <StatusBadge tone="neutral">{t("contracts.cancelled")}</StatusBadge>}
                  </td>
                  <td className={TD}>{c.startDate}</td>
                  <td className={TD}>{c.endDate ?? t("contracts.indefinite")}</td>
                  <td className={TD}>{c.weeklyHours ?? "—"}</td>
                  <td className={TD}>{c.fte ?? "—"}</td>
                  <td className={TD}>
                    {c.status === "active" && (
                      <Button size="sm" variant="tertiary" disabled={!cancelReason.trim()} onClick={() => cancel.mutate(c.id)}>
                        {t("contracts.cancel")}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      <form
        className={`${SURFACE} grid gap-3 p-4 sm:grid-cols-3`}
        onSubmit={(e) => {
          e.preventDefault();
          if (form.startDate) create.mutate();
        }}
      >
        <h2 className={`${SECTION_TITLE} sm:col-span-3`}>{t("contracts.new")}</h2>
        <div>
          <label htmlFor="c-type" className={LABEL}>
            {t("contracts.type")}
          </label>
          <select id="c-type" className={`${FIELD} w-full`} value={form.contractType} onChange={(e) => setForm({ ...form, contractType: e.target.value as ContractInput["contractType"] })}>
            {CONTRACT_TYPES.map((k) => (
              <option key={k} value={k}>
                {t(`contracts.type.${k}` as MessageKey)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="c-start" className={LABEL}>
            {t("contracts.start")} *
          </label>
          <input id="c-start" type="date" className={`${FIELD} w-full`} value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
        </div>
        <div>
          <label htmlFor="c-end" className={LABEL}>
            {t("contracts.end")}
          </label>
          <input id="c-end" type="date" className={`${FIELD} w-full`} value={form.endDate ?? ""} onChange={(e) => setForm({ ...form, endDate: e.target.value || null })} />
        </div>
        <div>
          <label htmlFor="c-prob" className={LABEL}>
            {t("contracts.probation")}
          </label>
          <input id="c-prob" type="date" className={`${FIELD} w-full`} value={form.probationEnd ?? ""} onChange={(e) => setForm({ ...form, probationEnd: e.target.value || null })} />
        </div>
        <div>
          <label htmlFor="c-hours" className={LABEL}>
            {t("contracts.weeklyHours")}
          </label>
          <input id="c-hours" type="number" step="0.5" className={`${FIELD} w-full`} value={form.weeklyHours ?? ""} onChange={(e) => setForm({ ...form, weeklyHours: e.target.value ? Number(e.target.value) : null })} />
        </div>
        <div>
          <label htmlFor="c-fte" className={LABEL}>
            {t("contracts.fte")}
          </label>
          <input id="c-fte" type="number" step="0.05" min={0.05} max={1} className={`${FIELD} w-full`} value={form.fte ?? ""} onChange={(e) => setForm({ ...form, fte: e.target.value ? Number(e.target.value) : null })} />
        </div>
        <div>
          <label htmlFor="c-agr" className={LABEL}>
            {t("contracts.agreement")}
          </label>
          <select id="c-agr" className={`${FIELD} w-full`} value={form.agreementId ?? ""} onChange={(e) => setForm({ ...form, agreementId: e.target.value || null })}>
            <option value="">{t("common.none")}</option>
            {(agreements.data ?? []).filter((a) => !a.archived).map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 self-end text-sm text-stone-700">
          <input type="checkbox" checked={form.remote} onChange={(e) => setForm({ ...form, remote: e.target.checked })} />
          {t("contracts.remote")}
        </label>
        <div className="flex items-end justify-end">
          <Button type="submit" variant="primary" icon={<IconPlus />} disabled={!form.startDate || create.isPending}>
            {t("common.add")}
          </Button>
        </div>
        <div className="sm:col-span-3">
          <ErrorBox error={create.error ?? cancel.error} />
        </div>
      </form>
    </div>
  );
}

export function OrganizationTab({ personId, locations }: { personId: string; locations: Option[] }) {
  const { t } = useI18n();
  const { people, structure } = useNovoRh();
  const qc = useQueryClient();
  const [locationId, setLocationId] = useState("");
  const [date, setDate] = useState(todayIn());
  const [reason, setReason] = useState("");
  const history = useQuery({ queryKey: ["novo-rh", "structure", "assignments", personId], queryFn: () => structure.listAssignments(personId) });
  const transfer = useMutation({
    mutationFn: () => people.transfer({ employeeId: personId, locationId, effectiveDate: date, reason }),
    onSuccess: () => {
      setReason("");
      void qc.invalidateQueries({ queryKey: ["novo-rh", "structure", "assignments", personId] });
      void qc.invalidateQueries({ queryKey: ["novo-rh", "person", personId] });
    },
  });
  const name = (id: string) => locations.find((l) => l.id === id)?.label ?? id;
  const centres = (history.data ?? []).filter((a) => a.unitType === "location");

  return (
    <div className="space-y-4">
      <section className={`${SURFACE} space-y-3 p-4`} aria-labelledby="transfer-title">
        <h2 id="transfer-title" className={SECTION_TITLE}>
          {t("people.transfer")}
        </h2>
        <div className="grid gap-2 sm:grid-cols-[1fr_160px_1fr_auto]">
          <select aria-label={t("people.transfer.to")} className={FIELD} value={locationId} onChange={(e) => setLocationId(e.target.value)}>
            <option value="">{t("people.transfer.to")}…</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
          <input aria-label={t("people.transfer.date")} type="date" className={FIELD} value={date} onChange={(e) => setDate(e.target.value)} />
          <input aria-label={t("people.reason")} placeholder={t("people.reason")} className={FIELD} value={reason} onChange={(e) => setReason(e.target.value)} />
          <Button variant="primary" disabled={!locationId || !reason.trim() || transfer.isPending} onClick={() => transfer.mutate()}>
            {t("people.transfer")}
          </Button>
        </div>
        <ErrorBox error={transfer.error} />
        {centres.length > 0 && (
          <ul className="text-sm text-stone-700">
            {centres.map((a) => (
              <li key={a.id}>
                {name(a.unitId)} · {a.validFrom} → {a.validTo ?? t("contracts.indefinite")}
              </li>
            ))}
          </ul>
        )}
      </section>
      <p className="text-xs text-stone-500">{t("structure.assignments.hint")}</p>
    </div>
  );
}

const KINDS: ManagerKind[] = ["direct", "approver_time", "approver_leave"];

export function ManagersTab({ personId, people: everyone }: { personId: string; people: { id: string; label: string }[] }) {
  const { t } = useI18n();
  const { people } = useNovoRh();
  const qc = useQueryClient();
  const [form, setForm] = useState({ managerEmployeeId: "", kind: "direct" as ManagerKind, level: 1, validFrom: todayIn() });
  const list = useQuery({ queryKey: ["novo-rh", "person", personId, "managers"], queryFn: () => people.listManagers(personId) });
  const refresh = () => void qc.invalidateQueries({ queryKey: ["novo-rh", "person", personId, "managers"] });
  const add = useMutation({ mutationFn: () => people.addManager(personId, { ...form, validTo: null }), onSuccess: refresh });
  const end = useMutation({ mutationFn: (id: string) => people.endManager(personId, id, todayIn()), onSuccess: refresh });
  const label = (id: string) => everyone.find((p) => p.id === id)?.label ?? id;

  return (
    <section className={`${SURFACE} space-y-3 p-4`}>
      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_90px_160px_auto]">
        <select aria-label={t("managers.who")} className={FIELD} value={form.managerEmployeeId} onChange={(e) => setForm({ ...form, managerEmployeeId: e.target.value })}>
          <option value="">{t("managers.who")}…</option>
          {everyone
            .filter((p) => p.id !== personId)
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
        </select>
        <select aria-label={t("contracts.type")} className={FIELD} value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as ManagerKind, level: 1 })}>
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {t(`managers.kind.${k}` as MessageKey)}
            </option>
          ))}
        </select>
        <select aria-label={t("managers.level")} className={FIELD} value={form.level} disabled={form.kind === "direct"} onChange={(e) => setForm({ ...form, level: Number(e.target.value) })}>
          {[1, 2, 3].map((n) => (
            <option key={n} value={n}>
              {n}.º
            </option>
          ))}
        </select>
        <input aria-label={t("common.from")} type="date" className={FIELD} value={form.validFrom} onChange={(e) => setForm({ ...form, validFrom: e.target.value })} />
        <Button variant="primary" icon={<IconPlus />} disabled={!form.managerEmployeeId || add.isPending} onClick={() => add.mutate()}>
          {t("common.add")}
        </Button>
      </div>
      {(list.data ?? []).length === 0 ? (
        <p className="text-sm text-stone-500">{t("managers.empty")}</p>
      ) : (
        <ul className="divide-y divide-[#F5C992]/40 text-sm">
          {list.data!.map((m) => (
            <li key={m.id} className="flex items-center justify-between py-2">
              <span>
                {t(`managers.kind.${m.kind}` as MessageKey)}
                {m.kind !== "direct" && ` (${m.level}.º)`}: {label(m.managerEmployeeId)} · {m.validFrom}
                {m.validTo ? ` → ${m.validTo}` : ""}
              </span>
              {!m.validTo && (
                <Button size="sm" variant="tertiary" onClick={() => end.mutate(m.id)}>
                  {t("common.end")}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      <ErrorBox error={add.error ?? end.error} />
    </section>
  );
}

export function PayTab({ personId }: { personId: string }) {
  const { t } = useI18n();
  const { people } = useNovoRh();
  const qc = useQueryClient();
  const [form, setForm] = useState({ itemId: "", amount: "", validFrom: todayIn() });
  const items = useQuery({ queryKey: ["novo-rh", "catalog", "items"], queryFn: () => people.listCompensationItems() });
  const list = useQuery({ queryKey: ["novo-rh", "person", personId, "pay"], queryFn: () => people.listCompensations(personId), retry: false });
  const refresh = () => void qc.invalidateQueries({ queryKey: ["novo-rh", "person", personId, "pay"] });
  const assign = useMutation({
    mutationFn: () => people.assignCompensation(personId, { itemId: form.itemId, amount: form.amount ? Number(form.amount) : null, validFrom: form.validFrom, validTo: null }),
    onSuccess: refresh,
  });
  const end = useMutation({ mutationFn: (id: string) => people.endCompensation(personId, id, todayIn()), onSuccess: refresh });
  if (list.isError) return <p className="text-sm text-stone-500">{t("people.hiddenValue")}</p>;
  const item = (id: string) => items.data?.find((i) => i.id === id);

  return (
    <section className={`${SURFACE} space-y-3 p-4`}>
      <div className="grid gap-2 sm:grid-cols-[1fr_140px_160px_auto]">
        <select aria-label={t("pay.item")} className={FIELD} value={form.itemId} onChange={(e) => setForm({ ...form, itemId: e.target.value })}>
          <option value="">{t("pay.item")}…</option>
          {(items.data ?? []).filter((i) => i.active).map((i) => (
            <option key={i.id} value={i.id}>
              {i.name} ({i.amount} {i.currency})
            </option>
          ))}
        </select>
        <input aria-label={t("pay.amount")} placeholder={t("pay.amount")} type="number" step="0.01" className={FIELD} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
        <input aria-label={t("common.from")} type="date" className={FIELD} value={form.validFrom} onChange={(e) => setForm({ ...form, validFrom: e.target.value })} />
        <Button variant="primary" icon={<IconPlus />} disabled={!form.itemId || assign.isPending} onClick={() => assign.mutate()}>
          {t("common.add")}
        </Button>
      </div>
      {(list.data ?? []).length === 0 ? (
        <p className="text-sm text-stone-500">{t("pay.empty")}</p>
      ) : (
        <ul className="divide-y divide-[#F5C992]/40 text-sm">
          {list.data!.map((a) => (
            <li key={a.id} className="flex items-center justify-between py-2">
              <span>
                {item(a.itemId)?.name ?? a.itemId} · {a.amount ?? item(a.itemId)?.amount} {item(a.itemId)?.currency} · {a.validFrom}
                {a.validTo ? ` → ${a.validTo}` : ""}
              </span>
              {!a.validTo && (
                <Button size="sm" variant="tertiary" onClick={() => end.mutate(a.id)}>
                  {t("common.end")}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      <ErrorBox error={assign.error ?? end.error} />
    </section>
  );
}

export function CustomFieldsTab({ personId }: { personId: string }) {
  const { t } = useI18n();
  const { people } = useNovoRh();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["novo-rh", "person", personId, "custom"], queryFn: () => people.getCustomValues(personId) });
  const [draft, setDraft] = useState<Record<string, string>>({});
  const save = useMutation({
    mutationFn: () => people.setCustomValues(personId, Object.fromEntries(Object.entries(draft).map(([k, v]) => [k, v.trim() || null]))),
    onSuccess: () => (setDraft({}), void qc.invalidateQueries({ queryKey: ["novo-rh", "person", personId, "custom"] })),
  });
  if ((q.data ?? []).length === 0) return <p className="text-sm text-stone-500">{t("custom.empty")}</p>;
  return (
    <section className={`${SURFACE} space-y-3 p-4`}>
      {q.data!.map(({ field, value, hidden }) => {
        const v = draft[field.id] ?? value ?? "";
        return (
          <div key={field.id}>
            <label htmlFor={`cf-${field.id}`} className={LABEL}>
              {field.name}
            </label>
            {hidden ? (
              <p className="text-sm text-stone-400">{t("people.hiddenValue")}</p>
            ) : field.format === "options" ? (
              <select id={`cf-${field.id}`} className={`${FIELD} w-full`} value={v} onChange={(e) => setDraft({ ...draft, [field.id]: e.target.value })}>
                <option value="">—</option>
                {field.options.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            ) : (
              <input id={`cf-${field.id}`} className={`${FIELD} w-full`} value={v} onChange={(e) => setDraft({ ...draft, [field.id]: e.target.value })} />
            )}
          </div>
        );
      })}
      <ErrorBox error={save.error} />
      <div className="flex justify-end">
        <Button variant="primary" disabled={Object.keys(draft).length === 0 || save.isPending} onClick={() => save.mutate()}>
          {t("common.save")}
        </Button>
      </div>
    </section>
  );
}

export function PersonalRulesTab({ personId }: { personId: string }) {
  const { t } = useI18n();
  const { settings } = useNovoRh();
  const defs = useQuery({ queryKey: ["novo-rh", "settings", "definitions"], queryFn: () => settings.listDefinitions() });
  const eff = useQuery({ queryKey: ["novo-rh", "settings", "effective", personId, todayIn()], queryFn: () => settings.effective(personId, todayIn()) });
  const words = { yes: t("common.yes"), no: t("common.no") };
  const def = (k: string) => defs.data?.find((d) => d.key === k);
  return (
    <section className={`${SURFACE} space-y-2 p-4`}>
      <p className="text-xs text-stone-500">{t("people.rules.hint")}</p>
      <table className={TABLE}>
        <thead className={THEAD}>
          <tr>
            <th className={TH}>{t("settings.history.param")}</th>
            <th className={TH}>{t("settings.edit.value")}</th>
            <th className={TH}>{t("settings.effective.origin")}</th>
          </tr>
        </thead>
        <tbody>
          {(eff.data ?? []).map((s) => (
            <tr key={s.key} className={TR}>
              <td className={TD}>{def(s.key)?.label ?? s.key}</td>
              <td className={`${TD} font-semibold`}>{formatSettingValue(def(s.key), s.value, words)}</td>
              <td className={TD}>
                {t(LEVEL_KEY[s.origin.level])}
                {s.origin.profileName ? ` · ${s.origin.profileName}` : ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Link to="/hr/novo/configuracoes" className="text-sm text-[#C2410C] hover:underline">
        {t("novoRh.tab.settings")} →
      </Link>
    </section>
  );
}

/** FE-022: documentos da ficha (motor do módulo `hr`, encaixado pela raiz) e os documentos enviados à pessoa. */
export function DocumentsTab({ personId }: { personId: string }) {
  const { t } = useI18n();
  const slots = useNovoRhSlots();
  return (
    <div className="space-y-4">
      {slots.personDocuments ? (
        slots.personDocuments(personId)
      ) : (
        <section className={`${SURFACE} space-y-2 p-4`}>
          <p className="text-sm text-stone-600">{t("people.documents.hint")}</p>
        </section>
      )}
      <ReceivedDistributions personId={personId} />
    </div>
  );
}

/** Documentos enviados a esta pessoa (FE-065) com o estado de leitura. */
function ReceivedDistributions({ personId }: { personId: string }) {
  const { t } = useI18n();
  const { distributions } = useNovoRh();
  const q = useQuery({ queryKey: ["novo-rh", "document-distributions", "by-employee", personId], queryFn: () => distributions.forEmployee(personId) });
  if (q.isError) return null;
  return (
    <section className={`${SURFACE} space-y-2 p-4`} aria-label={t("people.documents.received")}>
      <h3 className={SECTION_TITLE}>{t("people.documents.received")}</h3>
      {q.isLoading && <p className="text-sm text-stone-400">{t("common.loading")}</p>}
      {q.data && q.data.length === 0 && <p className="text-sm text-stone-500">{t("people.documents.receivedNone")}</p>}
      <ul className="divide-y divide-stone-100">
        {(q.data ?? []).map((d) => (
          <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
            <span className="text-stone-800">{d.title}</span>
            <span className="flex items-center gap-2 text-xs text-stone-500">
              {d.createdAt.slice(0, 10)}
              {d.confirmedAt ? (
                <StatusBadge tone="success">{t("docs.status.confirmed")}</StatusBadge>
              ) : d.readAt ? (
                <StatusBadge tone="neutral">{t("docs.status.read")}</StatusBadge>
              ) : (
                <StatusBadge tone="warning">{t("docs.status.delivered")}</StatusBadge>
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
