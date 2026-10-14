import { useI18n } from "../../../../i18n/I18nProvider.tsx";
import { AlertBanner } from "../../../../components/ui/index.ts";
import { DataModeCard } from "./DemoMode.tsx";
import { DashboardView } from "./dashboard/DashboardView.tsx";
import { OverviewDashboard } from "./overview/OverviewDashboard.tsx";

/** RH → Visão geral: o Dashboard executivo (o modo de dados vive em Configurações). */
export function NovoRhHomeView() {
  return <DashboardView />;
}

/** Painel do dia anterior — continua acessível pelo endereço (/hr/novo/painel-anterior), fora da navegação. */
export function PreviousOverviewView() {
  const { t } = useI18n();
  return (
    <div className="space-y-4">
      <OverviewDashboard />
      <AlertBanner tone="info" title={t("novoRh.banner.title")}>
        {t("novoRh.banner.body")}
      </AlertBanner>
      <DataModeCard />
    </div>
  );
}
