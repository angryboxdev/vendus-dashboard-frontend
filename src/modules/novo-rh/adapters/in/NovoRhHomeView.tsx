import { Link } from "react-router-dom";
import { useI18n } from "../../../../i18n/I18nProvider.tsx";
import { AlertBanner, SURFACE } from "../../../../components/ui/index.ts";
import { DataModeSwitch } from "./DemoMode.tsx";
import { DashboardView } from "./dashboard/DashboardView.tsx";
import { OverviewDashboard } from "./overview/OverviewDashboard.tsx";

function DataModeSection() {
  const { t } = useI18n();
  return (
    <section className={`${SURFACE} p-4`} aria-labelledby="novo-rh-mode">
      <h2 id="novo-rh-mode" className="text-sm font-semibold text-stone-800">
        {t("novoRh.mode.label")}
      </h2>
      <DataModeSwitch />
    </section>
  );
}

/**
 * Novo RH → Visão geral: o Dashboard executivo e, por baixo, o modo de dados
 * (real ou demonstração). O painel anterior fica acessível durante a validação.
 */
export function NovoRhHomeView() {
  const { t } = useI18n();
  return (
    <div className="space-y-6">
      <DashboardView />
      <DataModeSection />
      <p className="text-right text-xs text-ink-secondary">
        <Link to="/hr/novo/painel-anterior" className="hover:underline">
          {t("novoRh.previousOverview.link")}
        </Link>
      </p>
    </div>
  );
}

/** Painel do dia anterior (quem está, faltas, atrasos, pendentes) — regresso temporário durante a validação. */
export function PreviousOverviewView() {
  const { t } = useI18n();
  return (
    <div className="space-y-4">
      <OverviewDashboard />
      <AlertBanner tone="info" title={t("novoRh.banner.title")}>
        {t("novoRh.banner.body")}
      </AlertBanner>
      <DataModeSection />
    </div>
  );
}
