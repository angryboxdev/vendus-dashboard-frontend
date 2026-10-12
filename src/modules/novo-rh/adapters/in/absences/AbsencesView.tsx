import { useState } from "react";
import { useI18n } from "../../../../../i18n/I18nProvider.tsx";
import { Tabs } from "../../../../../components/ui/index.ts";
import { FlowsPanel, TypesPanel } from "./ConfigPanels.tsx";
import { ApprovalsPanel, BalancesPanel, MyAbsencesPanel, RequestsPanel } from "./RequestPanels.tsx";
import { CalendarPanel } from "./CalendarPanel.tsx";

type Tab = "calendar" | "approvals" | "requests" | "balances" | "types" | "flows" | "mine";

/** Novo RH → Ausências (Fase 5). */
export function AbsencesView() {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>("approvals");
  return (
    <div className="space-y-4">
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { key: "calendar", label: t("abs.tab.calendar") },
          { key: "approvals", label: t("abs.tab.approvals") },
          { key: "requests", label: t("abs.tab.requests") },
          { key: "balances", label: t("abs.tab.balances") },
          { key: "types", label: t("abs.tab.types") },
          { key: "flows", label: t("abs.tab.flows") },
          { key: "mine", label: t("abs.tab.mine") },
        ]}
      />
      {tab === "calendar" && <CalendarPanel />}
      {tab === "approvals" && <ApprovalsPanel />}
      {tab === "requests" && <RequestsPanel />}
      {tab === "balances" && <BalancesPanel />}
      {tab === "types" && <TypesPanel />}
      {tab === "flows" && <FlowsPanel />}
      {tab === "mine" && <MyAbsencesPanel />}
    </div>
  );
}
