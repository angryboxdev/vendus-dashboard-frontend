import { useQuery } from "@tanstack/react-query";
import { useI18n } from "../../../../../i18n/I18nProvider.tsx";
import { Button, IconDownload, SECTION_TITLE, SURFACE, TABLE, TD, TH, THEAD, TR } from "../../../../../components/ui/index.ts";
import { formatSettingValue } from "../../../domain/services/settings-format.service.ts";
import { useNovoRh } from "../../../novo-rh.module.tsx";

/** CF-12: quem, quando, antes, depois, motivo — exportável. */
export function HistoryPanel() {
  const { t } = useI18n();
  const { settings } = useNovoRh();
  const q = useQuery({ queryKey: ["novo-rh", "settings", "history"], queryFn: () => settings.history({}) });
  const words = { yes: t("common.yes"), no: t("common.no") };

  const exportCsv = async () => {
    const blob = await settings.downloadHistoryCsv();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "historico-configuracoes.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className={`${SURFACE} p-4`} aria-labelledby="settings-history">
      <div className="flex items-center justify-between gap-2">
        <h2 id="settings-history" className={SECTION_TITLE}>
          {t("settings.history.title")}
        </h2>
        <Button size="sm" icon={<IconDownload />} onClick={() => void exportCsv()} disabled={!q.data?.length}>
          {t("settings.history.export")}
        </Button>
      </div>
      {q.isLoading ? (
        <p className="mt-2 text-sm text-stone-400">{t("common.loading")}</p>
      ) : !q.data?.length ? (
        <p className="mt-2 text-sm text-stone-500">{t("settings.history.empty")}</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className={TABLE}>
            <thead className={THEAD}>
              <tr>
                <th className={TH}>{t("settings.history.when")}</th>
                <th className={TH}>{t("settings.history.who")}</th>
                <th className={TH}>{t("settings.history.profile")}</th>
                <th className={TH}>{t("settings.history.param")}</th>
                <th className={TH}>{t("settings.history.before")}</th>
                <th className={TH}>{t("settings.history.after")}</th>
                <th className={TH}>{t("settings.edit.validFrom")}</th>
                <th className={TH}>{t("settings.history.reason")}</th>
              </tr>
            </thead>
            <tbody>
              {q.data.map((h) => (
                <tr key={h.valueId} className={TR}>
                  <td className={TD}>{new Date(h.createdAt).toLocaleString("pt-PT")}</td>
                  <td className={TD}>{h.createdBy}</td>
                  <td className={TD}>{h.profileName}</td>
                  <td className={TD}>{h.label}</td>
                  <td className={TD}>{formatSettingValue(undefined, h.before, words)}</td>
                  <td className={`${TD} font-semibold`}>{formatSettingValue(undefined, h.after, words)}</td>
                  <td className={TD}>{h.validFrom}</td>
                  <td className={TD}>{h.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
