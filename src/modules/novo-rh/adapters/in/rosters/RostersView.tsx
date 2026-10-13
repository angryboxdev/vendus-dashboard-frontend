import { useState } from "react";
import { useI18n } from "../../../../../i18n/I18nProvider.tsx";
import {
  Button,
  IconChevronLeft,
  PageHeader,
} from "../../../../../components/ui/index.ts";
import { MyRosterPanel, SwapsPanel, TemplatesPanel } from "./OtherPanels.tsx";
import { PlannerPanel } from "./PlannerPanel.tsx";

type View = "planner" | "templates" | "swaps" | "mine";

/**
 * Novo RH → Escalas & Turnos (Design System Mezza). A escala é o ecrã
 * principal; modelos, trocas e "o meu horário" abrem a partir dela.
 */
export function RostersView() {
  const { t } = useI18n();
  const [view, setView] = useState<View>("planner");
  const sub: Record<Exclude<View, "planner">, string> = {
    templates: t("ros.tab.templates"),
    swaps: t("ros.tab.swaps"),
    mine: t("ros.tab.mine"),
  };
  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb={
          view === "planner" ? ["RH", "Escalas"] : ["RH", "Escalas", sub[view]]
        }
        title={view === "planner" ? t("ros.title") : sub[view]}
        description={view === "planner" ? t("ros.subtitle") : undefined}
      />
      {view === "planner" ? (
        <PlannerPanel
          onOpenTemplates={() => setView("templates")}
          onOpenSwaps={() => setView("swaps")}
          onOpenMine={() => setView("mine")}
        />
      ) : (
        <div className="space-y-4 motion-safe:animate-motion-fade-up">
          <Button
            icon={<IconChevronLeft size={16} />}
            onClick={() => setView("planner")}
          >
            {t("ros.backToPlanner")}
          </Button>
          {view === "templates" && <TemplatesPanel />}
          {view === "swaps" && <SwapsPanel />}
          {view === "mine" && <MyRosterPanel />}
        </div>
      )}
    </div>
  );
}
