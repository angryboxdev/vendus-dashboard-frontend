import { useI18n } from "../../../../i18n/I18nProvider.tsx";
import { AlertBanner, SURFACE } from "../../../../components/ui/index.ts";
import { DataModeSwitch } from "./DemoMode.tsx";
import { OverviewDashboard } from "./overview/OverviewDashboard.tsx";

/**
 * Novo RH → Visão geral: o Painel do dia (quem está, faltas, atrasos,
 * pendentes) e, por baixo, o modo de dados (real ou demonstração).
 */
export function NovoRhHomeView() {
  const { t } = useI18n();

  return (
    <div className="space-y-4">
      <OverviewDashboard />

      <AlertBanner tone="info" title={t("novoRh.banner.title")}>
        {t("novoRh.banner.body")}
      </AlertBanner>

      <section className={`${SURFACE} p-4`} aria-labelledby="novo-rh-mode">
        <h2 id="novo-rh-mode" className="text-sm font-semibold text-stone-800">
          {t("novoRh.mode.label")}
        </h2>
        <DataModeSwitch />
      </section>
    </div>
  );
}
