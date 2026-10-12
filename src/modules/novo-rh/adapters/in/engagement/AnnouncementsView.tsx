import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useI18n } from "../../../../../i18n/I18nProvider.tsx";
import type { MessageKey } from "../../../../../i18n/i18n.ts";
import { Button, FIELD, LABEL, SECTION_TITLE, StatusBadge, SURFACE, TABLE, TD, TH, THEAD, TR, Tabs } from "../../../../../components/ui/index.ts";
import type { Announcement, Audience } from "../../../domain/entities/engagement.ts";
import { shortDateTime } from "../../../domain/services/engagement.service.ts";
import { useNovoRh } from "../../../novo-rh.module.tsx";

const KEY = ["novo-rh", "announcements"];
const message = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

/** Novo RH → Comunicados (RE-31, RE-32). */
export function AnnouncementsView() {
  const { t } = useI18n();
  const [tab, setTab] = useState<"manage" | "mine">("manage");
  return (
    <div className="space-y-4">
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { key: "manage", label: t("ann.tab.manage") },
          { key: "mine", label: t("ann.tab.mine") },
        ]}
      />
      {tab === "manage" ? <ManagePanel /> : <MinePanel />}
    </div>
  );
}

function ManagePanel() {
  const { t } = useI18n();
  const { announcements, settings } = useNovoRh();
  const qc = useQueryClient();
  const list = useQuery({ queryKey: KEY, queryFn: () => announcements.list() });
  const employees = useQuery({ queryKey: ["novo-rh", "settings", "employees"], queryFn: () => settings.listEmployees() });
  const locations = useQuery({ queryKey: ["novo-rh", "settings", "locations"], queryFn: () => settings.listLocations() });
  const [v, setV] = useState({ title: "", body: "", type: "all" as Audience["type"], ids: [] as string[], requiresConfirmation: true });
  const [selected, setSelected] = useState<string | null>(null);
  const create = useMutation({
    mutationFn: () => announcements.create({ title: v.title, body: v.body, audience: v.type === "all" ? { type: "all" } : { type: v.type, ids: v.ids }, requiresConfirmation: v.requiresConfirmation }),
    onSuccess: async (a) => {
      setSelected(a.id);
      setV({ ...v, title: "", body: "" });
      await qc.invalidateQueries({ queryKey: KEY });
    },
  });
  const options = v.type === "locations" ? (locations.data ?? []) : (employees.data ?? []);
  return (
    <div className="space-y-4">
      <section className={`${SURFACE} space-y-2 p-4`} aria-label={t("ann.new")}>
        <h3 className={SECTION_TITLE}>{t("ann.new")}</h3>
        <label className="block">
          <span className={LABEL}>{t("ann.field.title")}</span>
          <input className={`${FIELD} w-full`} maxLength={160} value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} />
        </label>
        <label className="block">
          <span className={LABEL}>{t("ann.field.body")}</span>
          <textarea className={`${FIELD} w-full`} rows={4} value={v.body} onChange={(e) => setV({ ...v, body: e.target.value })} />
        </label>
        <div className="flex flex-wrap items-end gap-2">
          <label>
            <span className={LABEL}>{t("ann.field.audience")}</span>
            <select className={FIELD} value={v.type} onChange={(e) => setV({ ...v, type: e.target.value as Audience["type"], ids: [] })}>
              <option value="all">{t("ann.audience.all")}</option>
              <option value="locations">{t("ann.audience.locations")}</option>
              <option value="employees">{t("ann.audience.employees")}</option>
            </select>
          </label>
          {v.type !== "all" && (
            <select multiple aria-label={t(`ann.audience.${v.type}` as MessageKey)} className={`${FIELD} min-w-[200px]`} value={v.ids} onChange={(e) => setV({ ...v, ids: [...e.target.selectedOptions].map((o) => o.value) })}>
              {options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          )}
          <label className="flex items-center gap-1 pb-2 text-sm text-stone-700">
            <input type="checkbox" checked={v.requiresConfirmation} onChange={(e) => setV({ ...v, requiresConfirmation: e.target.checked })} />
            {t("ann.field.confirm")}
          </label>
          <Button variant="primary" disabled={!v.title.trim() || (v.type !== "all" && !v.ids.length) || create.isPending} onClick={() => create.mutate()}>
            {t("ann.create")}
          </Button>
        </div>
        {create.isError && <p className="text-sm text-red-700">{message(create.error, t("common.error"))}</p>}
      </section>
      <section className={`${SURFACE} space-y-2 p-4`}>
        {list.data?.length === 0 && <p className="text-sm text-stone-500">{t("ann.none")}</p>}
        <ul className="space-y-1 text-sm">
          {(list.data ?? []).map((a) => (
            <li key={a.id}>
              <button type="button" className={`flex flex-wrap items-center gap-2 rounded px-1 ${selected === a.id ? "bg-[#FDF8F5] font-semibold" : ""}`} onClick={() => setSelected(a.id)}>
                <span>{a.title}</span>
                <StatusBadge tone={a.status === "published" ? "success" : "neutral"}>{t(`ann.status.${a.status}` as MessageKey)}</StatusBadge>
                {a.status === "published" && <span className="text-xs text-stone-500">{t("ann.version", { version: a.currentVersion })}</span>}
              </button>
            </li>
          ))}
        </ul>
      </section>
      {selected && list.data?.find((a) => a.id === selected) && <Detail key={selected} a={list.data.find((x) => x.id === selected)!} />}
    </div>
  );
}

function Detail({ a }: { a: Announcement }) {
  const { t } = useI18n();
  const { announcements, settings } = useNovoRh();
  const qc = useQueryClient();
  const employees = useQuery({ queryKey: ["novo-rh", "settings", "employees"], queryFn: () => settings.listEmployees() });
  const name = (id: string) => employees.data?.find((e) => e.id === id)?.label ?? id;
  const [body, setBody] = useState(a.body);
  const publish = useMutation({ mutationFn: () => announcements.publish(a.id), onSuccess: () => qc.invalidateQueries({ queryKey: KEY }) });
  const save = useMutation({ mutationFn: () => announcements.update(a.id, { body }), onSuccess: () => qc.invalidateQueries({ queryKey: KEY }) });
  const report = useQuery({ queryKey: [...KEY, "report", a.id, a.currentVersion], queryFn: () => announcements.report(a.id), enabled: a.status === "published" });
  return (
    <section className={`${SURFACE} space-y-3 p-4`} aria-label={a.title}>
      <h3 className={SECTION_TITLE}>{a.title}</h3>
      <textarea aria-label={t("ann.field.body")} className={`${FIELD} w-full`} rows={4} value={body} onChange={(e) => setBody(e.target.value)} />
      <div className="flex flex-wrap items-center gap-2">
        {a.status === "draft" ? (
          <>
            <Button variant="primary" disabled={publish.isPending} onClick={() => publish.mutate()}>
              {t("ann.publish")}
            </Button>
            <span className="text-xs text-stone-500">{t("ann.publish.hint")}</span>
          </>
        ) : (
          <Button disabled={body === a.body || save.isPending} onClick={() => save.mutate()}>
            {t("ann.newVersion")}
          </Button>
        )}
      </div>
      {(publish.isError || save.isError) && <p className="text-sm text-red-700">{message(publish.error ?? save.error, t("common.error"))}</p>}
      {report.data && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-stone-900">{t("ann.report.totals", { ...report.data.totals, version: report.data.announcement.currentVersion })}</p>
          <table className={TABLE}>
            <thead className={THEAD}>
              <tr>
                <th className={TH}>{t("common.employee")}</th>
                <th className={TH}>{t("ann.version", { version: "" })}</th>
                <th className={TH}>{t("ann.receipt.delivered")}</th>
                <th className={TH}>{t("ann.receipt.read")}</th>
                <th className={TH}>{t("ann.receipt.confirmed")}</th>
              </tr>
            </thead>
            <tbody>
              {report.data.rows.map((r) => (
                <tr key={`${r.employeeId}-${r.version}`} className={TR}>
                  <td className={TD}>{name(r.employeeId)}</td>
                  <td className={TD}>{r.version}</td>
                  <td className={TD}>{shortDateTime(r.deliveredAt)}</td>
                  <td className={TD}>{shortDateTime(r.readAt)}</td>
                  <td className={TD}>
                    <StatusBadge tone={r.status === "confirmed" ? "success" : r.status === "read" ? "neutral" : "warning"}>{t(`ann.receipt.${r.status}` as MessageKey)}</StatusBadge>
                    {r.confirmedAt && <span className="ml-1 text-xs text-stone-500">{shortDateTime(r.confirmedAt)}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function MinePanel() {
  const { t } = useI18n();
  const { announcements } = useNovoRh();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: [...KEY, "mine"], queryFn: () => announcements.mine(), retry: false });
  const read = useMutation({ mutationFn: (id: string) => announcements.markRead(id), onSuccess: () => qc.invalidateQueries({ queryKey: KEY }) });
  const confirm = useMutation({ mutationFn: (id: string) => announcements.confirm(id), onSuccess: () => qc.invalidateQueries({ queryKey: KEY }) });
  if (q.isError) return <p className="text-sm text-amber-800">{message(q.error, t("common.loadError"))}</p>;
  return (
    <div className="space-y-3">
      {q.data?.length === 0 && <p className="text-sm text-stone-500">{t("ann.mine.none")}</p>}
      {(q.data ?? []).map((a) => (
        <article key={a.id} className={`${SURFACE} space-y-2 p-4`} aria-label={a.title}>
          <h3 className={SECTION_TITLE}>
            {a.title} <span className="text-xs font-normal text-stone-500">{t("ann.version", { version: a.version })}</span>
          </h3>
          <p className="whitespace-pre-wrap text-sm text-stone-700">{a.body}</p>
          {a.confirmedAt ? (
            <StatusBadge tone="success">{t("ann.confirmed", { date: shortDateTime(a.confirmedAt) })}</StatusBadge>
          ) : a.requiresConfirmation ? (
            <Button size="sm" variant="primary" disabled={confirm.isPending} onClick={() => confirm.mutate(a.id)}>
              {t("ann.confirm")}
            </Button>
          ) : (
            !a.readAt && (
              <Button size="sm" disabled={read.isPending} onClick={() => read.mutate(a.id)}>
                {t("ann.markRead")}
              </Button>
            )
          )}
        </article>
      ))}
    </div>
  );
}
