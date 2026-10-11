import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useI18n } from "../../../../../i18n/I18nProvider.tsx";
import { AlertBanner, Button, FIELD, IconDownload, SECTION_TITLE, SURFACE, TABLE, TD, TH, THEAD, TR } from "../../../../../components/ui/index.ts";
import { useNovoRh } from "../../../novo-rh.module.tsx";
import { downloadBlob } from "../download.ts";

const show = (v: unknown) => (v === null || v === undefined ? "—" : typeof v === "string" ? v : JSON.stringify(v));

/** Novo RH → Auditoria (ticket 08): consulta, exportação e verificação da cadeia. */
export function AuditView() {
  const { t } = useI18n();
  const { audit } = useNovoRh();
  const [filter, setFilter] = useState<{ resourceType?: string; from?: string; to?: string }>({});
  const q = useQuery({ queryKey: ["novo-rh", "audit", filter], queryFn: () => audit.list(filter) });
  const verify = useMutation({ mutationFn: () => audit.verify() });

  return (
    <section className={`${SURFACE} space-y-3 p-4`} aria-labelledby="audit-title">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id="audit-title" className={SECTION_TITLE}>
            {t("audit.title")}
          </h2>
          <p className="text-xs text-stone-500">{t("audit.hint")}</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => verify.mutate()} disabled={verify.isPending}>
            {t("audit.verify")}
          </Button>
          <Button size="sm" icon={<IconDownload />} onClick={() => void audit.downloadCsv(filter).then((b) => downloadBlob(b, "auditoria.csv"))}>
            {t("common.exportCsv")}
          </Button>
        </div>
      </div>
      {verify.data && (
        <AlertBanner tone={verify.data.intact ? "success" : "danger"} title={t("audit.verify")}>
          {verify.data.intact ? t("audit.intact") : t("audit.broken", { seq: verify.data.brokenAtSeq ?? "?" })}
        </AlertBanner>
      )}
      <div className="flex flex-wrap gap-2">
        <select aria-label={t("audit.resource")} className={FIELD} value={filter.resourceType ?? ""} onChange={(e) => setFilter({ ...filter, resourceType: e.target.value || undefined })}>
          <option value="">{t("audit.resource")}: —</option>
          {["setting_profile", "org_department", "org_group", "employee", "org_contact", "org_terms", "user", "access_profile"].map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <input aria-label={t("common.from")} type="date" className={FIELD} value={filter.from ?? ""} onChange={(e) => setFilter({ ...filter, from: e.target.value || undefined })} />
        <input aria-label={t("common.to")} type="date" className={FIELD} value={filter.to ?? ""} onChange={(e) => setFilter({ ...filter, to: e.target.value || undefined })} />
      </div>
      {q.isLoading ? (
        <p className="text-sm text-stone-400">{t("common.loading")}</p>
      ) : (q.data ?? []).length === 0 ? (
        <p className="text-sm text-stone-500">{t("audit.empty")}</p>
      ) : (
        <div className="max-h-[480px] overflow-auto">
          <table className={TABLE}>
            <thead className={THEAD}>
              <tr>
                <th className={TH}>N.º</th>
                <th className={TH}>{t("settings.history.when")}</th>
                <th className={TH}>{t("settings.history.who")}</th>
                <th className={TH}>{t("audit.action")}</th>
                <th className={TH}>{t("settings.history.before")}</th>
                <th className={TH}>{t("settings.history.after")}</th>
                <th className={TH}>{t("settings.history.reason")}</th>
                <th className={TH}>IP</th>
              </tr>
            </thead>
            <tbody>
              {q.data!.map((e) => (
                <tr key={e.id} className={TR}>
                  <td className={TD}>{e.seq}</td>
                  <td className={TD}>{new Date(e.occurredAt).toLocaleString("pt-PT")}</td>
                  <td className={TD}>{e.actor}</td>
                  <td className={TD}>{e.action}</td>
                  <td className={`${TD} max-w-[220px] truncate`} title={show(e.before)}>
                    {show(e.before)}
                  </td>
                  <td className={`${TD} max-w-[220px] truncate`} title={show(e.after)}>
                    {show(e.after)}
                  </td>
                  <td className={TD}>{e.reason ?? "—"}</td>
                  <td className={TD}>{e.ip ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
