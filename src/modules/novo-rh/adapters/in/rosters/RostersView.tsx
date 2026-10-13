import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useI18n } from "../../../../../i18n/I18nProvider.tsx";
import {
  Button,
  IconChevronLeft,
  PageHeader,
} from "../../../../../components/ui/index.ts";
import { MyRosterPanel, SwapsPanel, TemplatesPanel } from "./OtherPanels.tsx";
import { PlannerPanel } from "./PlannerPanel.tsx";
import { RostersOverview } from "./RostersOverview.tsx";

type View = "overview" | "planner" | "templates" | "swaps" | "mine";

/** Escala aberta na grelha (a mesma chave que o PlannerPanel lê). */
const ROSTER_KEY = "novo-rh-roster-id";

/**
 * Novo RH → Escalas & Turnos (Design System Mezza). Abre na visão macro
 * (todas as escalas, por local ou grupo); escolher uma abre a grelha dela.
 * Modelos, trocas e "o meu horário" abrem a partir da grelha.
 */
export function RostersView() {
  const { t } = useI18n();
  const [params, setParams] = useSearchParams();
  // Com ?escala= na URL (ex.: ao voltar da ficha de um colaborador), abre logo a grelha.
  const [view, setView] = useState<View>(() => (params.get("escala") ? "planner" : "overview"));
  const sub: Record<Exclude<View, "overview" | "planner">, string> = {
    templates: t("ros.tab.templates"),
    swaps: t("ros.tab.swaps"),
    mine: t("ros.tab.mine"),
  };
  const open = (rosterId: string) => {
    try {
      localStorage.setItem(ROSTER_KEY, rosterId);
    } catch {
      /* sem armazenamento: o planeamento abre na primeira escala */
    }
    setParams({ escala: rosterId }, { replace: true });
    setView("planner");
  };
  const back = (to: View, label: string) => (
    <Button
      icon={<IconChevronLeft size={16} />}
      onClick={() => {
        if (to === "overview") setParams({}, { replace: true });
        setView(to);
      }}
    >
      {label}
    </Button>
  );
  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb={
          view === "overview"
            ? ["RH", "Escalas"]
            : view === "planner"
              ? ["RH", "Escalas", t("ros.tab.planner")]
              : ["RH", "Escalas", sub[view]]
        }
        title={view === "overview" || view === "planner" ? t("ros.title") : sub[view]}
        description={view === "overview" || view === "planner" ? t("ros.subtitle") : undefined}
      />
      {view === "overview" && <RostersOverview onOpen={open} />}
      {view === "planner" && (
        <div className="space-y-4">
          {back("overview", t("ros.overview.back"))}
          <PlannerPanel
            onOpenTemplates={() => setView("templates")}
            onOpenSwaps={() => setView("swaps")}
            onOpenMine={() => setView("mine")}
          />
        </div>
      )}
      {(view === "templates" || view === "swaps" || view === "mine") && (
        <div className="space-y-4 motion-safe:animate-motion-fade-up">
          {back("planner", t("ros.backToPlanner"))}
          {view === "templates" && <TemplatesPanel />}
          {view === "swaps" && <SwapsPanel />}
          {view === "mine" && <MyRosterPanel />}
        </div>
      )}
    </div>
  );
}
