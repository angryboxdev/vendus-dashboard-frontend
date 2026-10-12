import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useI18n } from "../../../../../i18n/I18nProvider.tsx";
import type { MessageKey } from "../../../../../i18n/i18n.ts";
import { Button, FIELD, IconDownload, LABEL, SECTION_TITLE, StatusBadge, SURFACE, TABLE, TD, TH, THEAD, TR, Tabs } from "../../../../../components/ui/index.ts";
import type { Announcement, Audience } from "../../../domain/entities/engagement.ts";
import { shortDateTime } from "../../../domain/services/engagement.service.ts";
import { useNovoRh } from "../../../novo-rh.module.tsx";
import { downloadBlob } from "../download.ts";

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

type StatusFilter = "all" | Announcement["status"];
type ReceiptFilter = "all" | "delivered" | "read" | "confirmed";

/** Gestão (FE-060/061): criar com contagem de destinatários, lista com filtros e confirmações. */
function ManagePanel() {
  const { t } = useI18n();
  const { announcements, settings, structure } = useNovoRh();
  const qc = useQueryClient();
  const list = useQuery({ queryKey: KEY, queryFn: () => announcements.list() });
  const employees = useQuery({ queryKey: ["novo-rh", "settings", "employees"], queryFn: () => settings.listEmployees() });
  const locations = useQuery({ queryKey: ["novo-rh", "settings", "locations"], queryFn: () => settings.listLocations() });
  const departments = useQuery({ queryKey: ["novo-rh", "structure", "departments"], queryFn: () => structure.listDepartments() });
  const [v, setV] = useState({ title: "", body: "", type: "all" as Audience["type"], ids: [] as string[], requiresConfirmation: true });
  const [selected, setSelected] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const audience: Audience = v.type === "all" ? { type: "all" } : { type: v.type, ids: v.ids };
  const ready = v.type === "all" || v.ids.length > 0;
  const preview = useQuery({ queryKey: [...KEY, "preview", audience], queryFn: () => announcements.previewAudience(audience), enabled: ready });
  const create = useMutation({
    mutationFn: () => announcements.create({ title: v.title, body: v.body, audience, requiresConfirmation: v.requiresConfirmation }),
    onSuccess: async (a) => {
      setSelected(a.id);
      setV({ ...v, title: "", body: "" });
      await qc.invalidateQueries({ queryKey: KEY });
    },
  });
  const options =
    v.type === "locations"
      ? (locations.data ?? [])
      : v.type === "departments"
        ? (departments.data ?? []).filter((d) => !d.archived).map((d) => ({ id: d.id, label: d.name }))
        : (employees.data ?? []);
  const rows = (list.data ?? []).filter((a) => (status === "all" || a.status === status) && (!search || a.title.toLowerCase().includes(search.toLowerCase())));
  const current = list.data?.find((a) => a.id === selected);

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
              <option value="departments">{t("ann.audience.departments")}</option>
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
          <Button variant="primary" disabled={!v.title.trim() || !ready || create.isPending} onClick={() => create.mutate()}>
            {t("ann.create")}
          </Button>
        </div>
        {ready && preview.data && (
          <p className="text-xs text-stone-600" aria-live="polite">
            {t("ann.preview", { count: preview.data.recipients })}
            {preview.data.withoutAccount > 0 && ` ${t("ann.preview.noAccount", { count: preview.data.withoutAccount })}`}
          </p>
        )}
        {create.isError && <p className="text-sm text-red-700">{message(create.error, t("common.error"))}</p>}
      </section>

      <section className={`${SURFACE} space-y-3 p-4`}>
        <div className="flex flex-wrap items-center gap-2">
          <Tabs
            value={status}
            onChange={setStatus}
            items={(["all", "draft", "published", "archived"] as const).map((k) => ({ key: k, label: t(k === "all" ? "ann.filter.all" : (`ann.status.${k}` as MessageKey)) }))}
          />
          <input aria-label={t("ann.search")} placeholder={t("ann.search")} className={`${FIELD} ml-auto`} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {list.data && rows.length === 0 && <p className="text-sm text-stone-500">{t("ann.none")}</p>}
        {rows.length > 0 && (
          <table className={TABLE}>
            <thead className={THEAD}>
              <tr>
                <th className={TH}>{t("ann.field.title")}</th>
                <th className={TH}>{t("ann.col.status")}</th>
                <th className={TH}>{t("ann.col.published")}</th>
                <th className={TH}>{t("ann.col.progress")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id} className={`${TR} ${selected === a.id ? "bg-[#FDF8F5]" : ""}`}>
                  <td className={TD}>
                    <button type="button" className="text-left font-medium text-stone-900 hover:underline" onClick={() => setSelected(a.id)}>
                      {a.title}
                    </button>
                  </td>
                  <td className={TD}>
                    <StatusBadge tone={a.status === "published" ? "success" : "neutral"}>{t(`ann.status.${a.status}` as MessageKey)}</StatusBadge>
                    {a.status !== "draft" && <span className="ml-1 text-xs text-stone-500">{t("ann.version", { version: a.currentVersion })}</span>}
                  </td>
                  <td className={TD}>{shortDateTime(a.publishedAt)}</td>
                  <td className={TD}>
                    {a.stats
                      ? a.requiresConfirmation
                        ? t("ann.progress.confirmed", { done: a.stats.confirmed, total: a.stats.recipients })
                        : t("ann.progress.read", { done: a.stats.read, total: a.stats.recipients })
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      {current && <Detail key={`${current.id}-${current.currentVersion}-${current.status}`} a={current} onGone={() => setSelected(null)} onCopied={(id) => setSelected(id)} />}
    </div>
  );
}

/** Detalhe (FE-061/062): publicar, nova versão, duplicar, eliminar/arquivar, lembrete e prova de leitura. */
function Detail({ a, onGone, onCopied }: { a: Announcement; onGone: () => void; onCopied: (id: string) => void }) {
  const { t } = useI18n();
  const { announcements, settings } = useNovoRh();
  const qc = useQueryClient();
  const employees = useQuery({ queryKey: ["novo-rh", "settings", "employees"], queryFn: () => settings.listEmployees() });
  const name = (id: string) => employees.data?.find((e) => e.id === id)?.label ?? id;
  const [body, setBody] = useState(a.body);
  const [filter, setFilter] = useState<ReceiptFilter>("all");
  const refresh = () => qc.invalidateQueries({ queryKey: KEY });
  const publish = useMutation({ mutationFn: () => announcements.publish(a.id), onSuccess: refresh });
  const save = useMutation({ mutationFn: () => announcements.update(a.id, { body }), onSuccess: refresh });
  const duplicate = useMutation({ mutationFn: () => announcements.duplicate(a.id), onSuccess: async (c) => (await refresh(), onCopied(c.id)) });
  const remove = useMutation({ mutationFn: () => announcements.deleteDraft(a.id), onSuccess: async () => (await refresh(), onGone()) });
  const archive = useMutation({ mutationFn: () => announcements.archive(a.id), onSuccess: refresh });
  const remind = useMutation({ mutationFn: () => announcements.remind(a.id) });
  const proof = useMutation({ mutationFn: async () => downloadBlob(await announcements.proofCsv(a.id), `prova-leitura-v${a.currentVersion}.csv`) });
  const report = useQuery({ queryKey: [...KEY, "report", a.id, a.currentVersion], queryFn: () => announcements.report(a.id), enabled: a.status !== "draft" });
  const err = [publish, save, duplicate, remove, archive, remind, proof].find((m) => m.isError)?.error;
  const rows = (report.data?.rows ?? []).filter((r) => r.version === a.currentVersion && (filter === "all" || r.status === filter));

  return (
    <section className={`${SURFACE} space-y-3 p-4`} aria-label={a.title}>
      <h3 className={SECTION_TITLE}>{a.title}</h3>
      <textarea aria-label={t("ann.field.body")} className={`${FIELD} w-full`} rows={4} value={body} disabled={a.status === "archived"} onChange={(e) => setBody(e.target.value)} />
      <div className="flex flex-wrap items-center gap-2">
        {a.status === "draft" && (
          <>
            <Button variant="primary" disabled={publish.isPending} onClick={() => publish.mutate()}>
              {t("ann.publish")}
            </Button>
            <Button variant="danger" disabled={remove.isPending} onClick={() => remove.mutate()}>
              {t("ann.deleteDraft")}
            </Button>
          </>
        )}
        {a.status === "published" && (
          <>
            <Button disabled={body === a.body || save.isPending} onClick={() => save.mutate()}>
              {t("ann.newVersion")}
            </Button>
            <Button disabled={remind.isPending} onClick={() => remind.mutate()}>
              {t("ann.remind")}
            </Button>
            <Button variant="tertiary" disabled={archive.isPending} onClick={() => archive.mutate()}>
              {t("ann.archive")}
            </Button>
          </>
        )}
        {a.status !== "draft" && (
          <Button icon={<IconDownload />} disabled={proof.isPending} onClick={() => proof.mutate()}>
            {t("ann.proof")}
          </Button>
        )}
        <Button variant="tertiary" disabled={duplicate.isPending} onClick={() => duplicate.mutate()}>
          {t("ann.duplicate")}
        </Button>
        {a.status === "draft" && <span className="text-xs text-stone-500">{t("ann.publish.hint")}</span>}
      </div>
      {remind.data && <p className="text-xs text-stone-600">{t("ann.reminded", { notified: remind.data.notified, pending: remind.data.pending, withoutAccount: remind.data.withoutAccount })}</p>}
      {err && <p className="text-sm text-red-700">{message(err, t("common.error"))}</p>}
      {report.data && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-stone-900">{t("ann.report.totals", { ...report.data.totals, version: report.data.announcement.currentVersion })}</p>
            <select aria-label={t("ann.receipt.filter")} className={FIELD} value={filter} onChange={(e) => setFilter(e.target.value as ReceiptFilter)}>
              <option value="all">{t("ann.filter.all")}</option>
              <option value="delivered">{t("ann.receipt.delivered")}</option>
              <option value="read">{t("ann.receipt.read")}</option>
              <option value="confirmed">{t("ann.receipt.confirmed")}</option>
            </select>
          </div>
          <table className={TABLE}>
            <thead className={THEAD}>
              <tr>
                <th className={TH}>{t("common.employee")}</th>
                <th className={TH}>{t("ann.receipt.delivered")}</th>
                <th className={TH}>{t("ann.receipt.read")}</th>
                <th className={TH}>{t("ann.receipt.confirmed")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.employeeId}-${r.version}`} className={TR}>
                  <td className={TD}>{name(r.employeeId)}</td>
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
