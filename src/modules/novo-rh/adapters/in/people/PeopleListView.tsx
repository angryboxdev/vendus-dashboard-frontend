import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useI18n } from "../../../../../i18n/I18nProvider.tsx";
import { Button, FIELD, IconDownload, IconPlus, IconSearch, StatusBadge, SURFACE, TABLE, TD, TH, THEAD, TR, Tabs } from "../../../../../components/ui/index.ts";
import { useNovoRh } from "../../../novo-rh.module.tsx";
import { downloadBlob } from "../download.ts";
import { ImportPeopleDrawer } from "./ImportPeopleDrawer.tsx";
import { NewPersonDrawer } from "./NewPersonDrawer.tsx";

type Status = "active" | "inactive" | "all";

/** Novo RH → Pessoas: lista (só o âmbito de quem vê), criar, importar, exportar. */
export function PeopleListView() {
  const { t } = useI18n();
  const { people, settings } = useNovoRh();
  const [status, setStatus] = useState<Status>("active");
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const list = useQuery({ queryKey: ["novo-rh", "people", status, q], queryFn: () => people.list({ status, ...(q.trim() && { q: q.trim() }) }) });
  const locations = useQuery({ queryKey: ["novo-rh", "settings", "locations"], queryFn: () => settings.listLocations() });
  const locationName = (id: string | null) => (id ? (locations.data?.find((l) => l.id === id)?.label ?? "—") : "—");

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs
          value={status}
          onChange={setStatus}
          items={[
            { key: "active", label: t("people.status.active") },
            { key: "inactive", label: t("people.status.inactive") },
            { key: "all", label: t("people.status.all") },
          ]}
        />
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => setImporting(true)}>
            {t("people.import")}
          </Button>
          <Button size="sm" icon={<IconDownload />} onClick={() => void people.exportCsv().then((b) => downloadBlob(b, "colaboradores.csv"))}>
            {t("people.export")}
          </Button>
          <Button size="sm" variant="primary" icon={<IconPlus />} onClick={() => setCreating(true)}>
            {t("people.new")}
          </Button>
        </div>
      </div>
      <label className="relative block max-w-sm">
        <span className="pointer-events-none absolute left-2.5 top-2 text-stone-400">
          <IconSearch />
        </span>
        <input aria-label={t("people.search")} placeholder={t("people.search")} className={`${FIELD} w-full pl-8`} value={q} onChange={(e) => setQ(e.target.value)} />
      </label>

      <section className={`${SURFACE} overflow-x-auto`}>
        {list.isLoading ? (
          <p className="p-4 text-sm text-stone-400">{t("common.loading")}</p>
        ) : list.isError ? (
          <p className="p-4 text-sm text-red-700">{t("common.loadError")}</p>
        ) : (list.data ?? []).length === 0 ? (
          <p className="p-4 text-sm text-stone-500">{t("people.empty")}</p>
        ) : (
          <table className={TABLE}>
            <thead className={THEAD}>
              <tr>
                <th className={TH}>{t("people.col.name")}</th>
                <th className={TH}>{t("people.field.nif")}</th>
                <th className={TH}>{t("people.col.location")}</th>
                <th className={TH}>{t("people.col.hire")}</th>
                <th className={TH}>{t("people.col.status")}</th>
              </tr>
            </thead>
            <tbody>
              {list.data!.map((p) => (
                <tr key={p.id} className={TR}>
                  <td className={TD}>
                    <Link to={`/hr/novo/pessoas/${p.id}`} className="font-medium text-stone-900 hover:underline">
                      {p.fullName}
                    </Link>
                  </td>
                  <td className={TD}>{p.hidden.includes("nif") ? <span className="text-stone-400">{t("people.hiddenValue")}</span> : (p.nif ?? "—")}</td>
                  <td className={TD}>{locationName(p.primaryLocationId)}</td>
                  <td className={TD}>{p.hireDate ?? "—"}</td>
                  <td className={TD}>
                    <div className="flex flex-wrap gap-1">
                      <StatusBadge tone={p.status === "active" ? "success" : "neutral"}>{p.status === "active" ? t("people.active") : t("people.inactive")}</StatusBadge>
                      {p.missing.length > 0 && <StatusBadge tone="warning">{t("people.toComplete")}</StatusBadge>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <NewPersonDrawer open={creating} onClose={() => setCreating(false)} locations={locations.data ?? []} />
      <ImportPeopleDrawer open={importing} onClose={() => setImporting(false)} />
    </div>
  );
}
