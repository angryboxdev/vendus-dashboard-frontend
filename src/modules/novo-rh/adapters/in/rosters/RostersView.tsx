import { useState } from "react";
import { useI18n } from "../../../../../i18n/I18nProvider.tsx";
import { Tabs } from "../../../../../components/ui/index.ts";
import { MyRosterPanel, SwapsPanel, TemplatesPanel } from "./OtherPanels.tsx";
import { PlannerPanel } from "./PlannerPanel.tsx";

type Tab = "planner" | "templates" | "swaps" | "mine";

/** Novo RH → Escalas (Fase 7). */
export function RostersView() {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>("planner");
  return (
    <div className="space-y-4">
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { key: "planner", label: t("ros.tab.planner") },
          { key: "templates", label: t("ros.tab.templates") },
          { key: "swaps", label: t("ros.tab.swaps") },
          { key: "mine", label: t("ros.tab.mine") },
        ]}
      />
      {tab === "planner" && <PlannerPanel />}
      {tab === "templates" && <TemplatesPanel />}
      {tab === "swaps" && <SwapsPanel />}
      {tab === "mine" && <MyRosterPanel />}
    </div>
  );
}
