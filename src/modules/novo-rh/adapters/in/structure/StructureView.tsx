import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useI18n } from "../../../../../i18n/I18nProvider.tsx";
import type { MessageKey } from "../../../../../i18n/i18n.ts";
import { AlertBanner, Button, FIELD, IconPlus, LABEL, SECTION_TITLE, SURFACE, TABLE, TD, TH, THEAD, TR } from "../../../../../components/ui/index.ts";
import { CONTACT_ROLES, type Contact, type ContactRole, type Group, type UnitType } from "../../../domain/entities/governance.ts";
import { groupTree } from "../../../domain/services/structure.service.ts";
import { todayIn } from "../../../domain/services/settings-format.service.ts";
import { useNovoRh } from "../../../novo-rh.module.tsx";
import { CatalogSections } from "./CatalogSections.tsx";

const KEY = ["novo-rh", "structure"] as const;

function Section({ id, title, hint, action, children }: { id: string; title: string; hint: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className={`${SURFACE} p-4`} aria-labelledby={id}>
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id={id} className={SECTION_TITLE}>
            {title}
          </h2>
          <p className="text-xs text-stone-500">{hint}</p>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function ErrorLine({ error }: { error: unknown }) {
  const { t } = useI18n();
  if (!error) return null;
  return (
    <AlertBanner tone="danger" title={t("common.error")}>
      {error instanceof Error ? error.message : ""}
    </AlertBanner>
  );
}

function Departments() {
  const { t } = useI18n();
  const { structure } = useNovoRh();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const q = useQuery({ queryKey: [...KEY, "departments"], queryFn: () => structure.listDepartments() });
  const refresh = () => void qc.invalidateQueries({ queryKey: KEY });
  const create = useMutation({ mutationFn: () => structure.createDepartment(name), onSuccess: () => (setName(""), refresh()) });
  const archive = useMutation({ mutationFn: (id: string) => structure.updateDepartment(q.data!.find((d) => d.id === id)!, { archived: true }), onSuccess: refresh });
  const active = (q.data ?? []).filter((d) => !d.archived);
  return (
    <Section id="dep-title" title={t("structure.departments.title")} hint={t("structure.departments.hint")}>
      <form
        className="mb-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) create.mutate();
        }}
      >
        <input aria-label={t("structure.departments.new")} placeholder={t("structure.departments.new")} className={`${FIELD} flex-1`} value={name} onChange={(e) => setName(e.target.value)} />
        <Button type="submit" variant="primary" icon={<IconPlus />} disabled={!name.trim() || create.isPending}>
          {t("common.add")}
        </Button>
      </form>
      {active.length === 0 ? (
        <p className="text-sm text-stone-500">{t("structure.departments.empty")}</p>
      ) : (
        <ul className="divide-y divide-[#F5C992]/40">
          {active.map((d) => (
            <li key={d.id} className="flex items-center justify-between py-2 text-sm">
              <span>{d.name}</span>
              <Button size="sm" variant="tertiary" onClick={() => archive.mutate(d.id)} aria-label={`${t("common.archive")} ${d.name}`}>
                {t("common.archive")}
              </Button>
            </li>
          ))}
        </ul>
      )}
      <ErrorLine error={create.error ?? archive.error} />
    </Section>
  );
}

function Groups() {
  const { t } = useI18n();
  const { structure } = useNovoRh();
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: "", code: "", parentId: "", color: "#ED5C32", hidden: false });
  const q = useQuery({ queryKey: [...KEY, "groups"], queryFn: () => structure.listGroups() });
  const refresh = () => void qc.invalidateQueries({ queryKey: KEY });
  const create = useMutation({
    mutationFn: () => structure.createGroup({ name: form.name, code: form.code, parentId: form.parentId || null, color: form.color, description: null, hidden: form.hidden }),
    onSuccess: () => (setForm({ ...form, name: "", code: "" }), refresh()),
  });
  const archive = useMutation({ mutationFn: (g: Group) => structure.updateGroup(g, { archived: true }), onSuccess: refresh });
  const active = (q.data ?? []).filter((g) => !g.archived);
  const tree = groupTree(active);

  return (
    <Section id="grp-title" title={t("structure.groups.title")} hint={t("structure.groups.hint")}>
      <form
        className="mb-3 grid gap-2 sm:grid-cols-[1fr_120px_1fr_auto_auto]"
        onSubmit={(e) => {
          e.preventDefault();
          if (form.name.trim() && form.code.trim()) create.mutate();
        }}
      >
        <input aria-label={t("common.name")} placeholder={t("structure.groups.new")} className={FIELD} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input aria-label={t("structure.groups.code")} placeholder={t("structure.groups.code")} className={FIELD} maxLength={30} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
        <select aria-label={t("structure.groups.parent")} className={FIELD} value={form.parentId} onChange={(e) => setForm({ ...form, parentId: e.target.value })}>
          <option value="">{t("structure.groups.parent")}: {t("common.none")}</option>
          {tree.map(({ group, depth }) => (
            <option key={group.id} value={group.id}>
              {"— ".repeat(depth)}
              {group.name}
            </option>
          ))}
        </select>
        <input aria-label={t("structure.groups.color")} type="color" className="h-9 w-12 rounded border border-stone-300" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
        <Button type="submit" variant="primary" icon={<IconPlus />} disabled={!form.name.trim() || !form.code.trim() || create.isPending}>
          {t("common.add")}
        </Button>
      </form>
      {tree.length === 0 ? (
        <p className="text-sm text-stone-500">{t("structure.groups.empty")}</p>
      ) : (
        <ul className="divide-y divide-[#F5C992]/40">
          {tree.map(({ group, depth }) => (
            <li key={group.id} className="flex items-center justify-between py-2 text-sm" style={{ paddingLeft: depth * 20 }}>
              <span className="flex items-center gap-2">
                <span aria-hidden className="inline-block h-3 w-3 rounded-full" style={{ background: group.color ?? "#d6d3d1" }} />
                {group.name} <span className="text-xs text-stone-400">{group.code}</span>
              </span>
              <Button size="sm" variant="tertiary" onClick={() => archive.mutate(group)} aria-label={`${t("common.archive")} ${group.name}`}>
                {t("common.archive")}
              </Button>
            </li>
          ))}
        </ul>
      )}
      <ErrorLine error={create.error ?? archive.error} />
    </Section>
  );
}

function Assignments() {
  const { t } = useI18n();
  const { structure, settings } = useNovoRh();
  const qc = useQueryClient();
  const [employeeId, setEmployeeId] = useState("");
  const [unit, setUnit] = useState("");
  const [validFrom, setValidFrom] = useState(todayIn());
  const employees = useQuery({ queryKey: ["novo-rh", "settings", "employees"], queryFn: () => settings.listEmployees() });
  const deps = useQuery({ queryKey: [...KEY, "departments"], queryFn: () => structure.listDepartments() });
  const groups = useQuery({ queryKey: [...KEY, "groups"], queryFn: () => structure.listGroups() });
  const list = useQuery({ queryKey: [...KEY, "assignments", employeeId], queryFn: () => structure.listAssignments(employeeId), enabled: !!employeeId });
  const refresh = () => void qc.invalidateQueries({ queryKey: [...KEY, "assignments"] });
  const assign = useMutation({
    mutationFn: () => {
      const [unitType, unitId] = unit.split(":") as [UnitType, string];
      return structure.assign({ employeeId, unitType, unitId, validFrom, validTo: null });
    },
    onSuccess: () => (setUnit(""), refresh()),
  });
  const end = useMutation({ mutationFn: (id: string) => structure.endAssignment(id, todayIn()), onSuccess: refresh });
  const nameOf = (type: UnitType, id: string) => (type === "department" ? deps.data?.find((d) => d.id === id)?.name : groups.data?.find((g) => g.id === id)?.name) ?? id;

  return (
    <Section id="asg-title" title={t("structure.assignments.title")} hint={t("structure.assignments.hint")}>
      <div className="mb-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto]">
        <select aria-label={t("common.employee")} className={FIELD} value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
          <option value="">{t("common.employee")}…</option>
          {(employees.data ?? []).map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
        <select aria-label={t("structure.assignments.unit")} className={FIELD} value={unit} onChange={(e) => setUnit(e.target.value)} disabled={!employeeId}>
          <option value="">{t("structure.assignments.unit")}…</option>
          <optgroup label={t("structure.departments.title")}>
            {(deps.data ?? []).filter((d) => !d.archived).map((d) => (
              <option key={d.id} value={`department:${d.id}`}>
                {d.name}
              </option>
            ))}
          </optgroup>
          <optgroup label={t("structure.groups.title")}>
            {(groups.data ?? []).filter((g) => !g.archived).map((g) => (
              <option key={g.id} value={`group:${g.id}`}>
                {g.name}
              </option>
            ))}
          </optgroup>
        </select>
        <input aria-label={t("common.from")} type="date" className={FIELD} value={validFrom} onChange={(e) => setValidFrom(e.target.value)} />
        <Button variant="primary" icon={<IconPlus />} disabled={!employeeId || !unit || assign.isPending} onClick={() => assign.mutate()}>
          {t("common.add")}
        </Button>
      </div>
      {employeeId && (list.data?.length ?? 0) === 0 && <p className="text-sm text-stone-500">{t("structure.assignments.empty")}</p>}
      {!!list.data?.length && (
        <table className={TABLE}>
          <thead className={THEAD}>
            <tr>
              <th className={TH}>{t("structure.assignments.unit")}</th>
              <th className={TH}>{t("common.from")}</th>
              <th className={TH}>{t("common.to")}</th>
              <th className={TH}>
                <span className="sr-only">{t("common.end")}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {list.data.map((a) => (
              <tr key={a.id} className={TR}>
                <td className={TD}>{nameOf(a.unitType, a.unitId)}</td>
                <td className={TD}>{a.validFrom}</td>
                <td className={TD}>{a.validTo ?? "—"}</td>
                <td className={TD}>
                  {!a.validTo && (
                    <Button size="sm" variant="tertiary" onClick={() => end.mutate(a.id)}>
                      {t("common.end")}
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <ErrorLine error={assign.error ?? end.error} />
    </Section>
  );
}

function ContactRow({ role, current }: { role: ContactRole; current: Contact | undefined }) {
  const { t } = useI18n();
  const { structure } = useNovoRh();
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: current?.name ?? "", email: current?.email ?? "", phone: current?.phone ?? "" });
  const save = useMutation({
    mutationFn: () => structure.setContact(role, { name: form.name, email: form.email || null, phone: form.phone || null }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: [...KEY, "contacts"] }),
  });
  const label = t(`structure.contact.${role}` as MessageKey);
  return (
    <form
      className="grid items-end gap-2 py-2 sm:grid-cols-[180px_1fr_1fr_140px_auto]"
      onSubmit={(e) => {
        e.preventDefault();
        if (form.name.trim()) save.mutate();
      }}
    >
      <span className="text-sm font-medium text-stone-800">{label}</span>
      <input aria-label={`${label} — ${t("common.name")}`} placeholder={t("common.name")} className={FIELD} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      <input aria-label={`${label} — ${t("common.email")}`} placeholder={t("common.email")} type="email" className={FIELD} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
      <input aria-label={`${label} — ${t("common.phone")}`} placeholder={t("common.phone")} className={FIELD} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
      <Button type="submit" size="sm" disabled={!form.name.trim() || save.isPending}>
        {t("common.save")}
      </Button>
      {save.isError && <p className="text-xs text-red-700 sm:col-span-5">{save.error instanceof Error ? save.error.message : ""}</p>}
    </form>
  );
}

function Contacts() {
  const { t } = useI18n();
  const { structure } = useNovoRh();
  const q = useQuery({ queryKey: [...KEY, "contacts"], queryFn: () => structure.listContacts() });
  return (
    <Section id="con-title" title={t("structure.contacts.title")} hint={t("structure.contacts.hint")}>
      {q.isLoading ? (
        <p className="text-sm text-stone-400">{t("common.loading")}</p>
      ) : (
        <div className="divide-y divide-[#F5C992]/40">
          {CONTACT_ROLES.map((role) => (
            <ContactRow key={role} role={role} current={q.data?.find((c) => c.role === role)} />
          ))}
        </div>
      )}
    </Section>
  );
}

function Terms() {
  const { t } = useI18n();
  const { structure } = useNovoRh();
  const qc = useQueryClient();
  const [version, setVersion] = useState("");
  const q = useQuery({ queryKey: [...KEY, "terms"], queryFn: () => structure.listTerms() });
  const accept = useMutation({ mutationFn: () => structure.acceptTerms(version), onSuccess: () => (setVersion(""), void qc.invalidateQueries({ queryKey: [...KEY, "terms"] })) });
  return (
    <Section id="trm-title" title={t("structure.terms.title")} hint={t("structure.terms.hint")}>
      <div className="mb-3 flex gap-2">
        <div>
          <label htmlFor="terms-version" className={LABEL}>
            {t("structure.terms.version")}
          </label>
          <input id="terms-version" className={FIELD} maxLength={40} value={version} onChange={(e) => setVersion(e.target.value)} />
        </div>
        <div className="self-end">
          <Button variant="primary" disabled={!version.trim() || accept.isPending} onClick={() => accept.mutate()}>
            {t("structure.terms.accept")}
          </Button>
        </div>
      </div>
      {(q.data ?? []).length === 0 ? (
        <p className="text-sm text-stone-500">{t("structure.terms.empty")}</p>
      ) : (
        <ul className="space-y-1 text-sm text-stone-700">
          {q.data!.map((a) => (
            <li key={a.id}>
              {a.version} · {new Date(a.acceptedAt).toLocaleString("pt-PT")} · {a.acceptedBy}
              {a.ip ? ` · ${a.ip}` : ""}
            </li>
          ))}
        </ul>
      )}
      <ErrorLine error={accept.error} />
    </Section>
  );
}

/** Novo RH → Estrutura (ticket 08): departamentos, grupos, pertenças, contactos e termos. */
export function StructureView() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Departments />
        <Groups />
      </div>
      <Assignments />
      <CatalogSections />
      <Contacts />
      <Terms />
    </div>
  );
}
