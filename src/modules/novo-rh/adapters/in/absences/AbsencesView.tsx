import { useState } from "react";
import { useI18n } from "../../../../../i18n/I18nProvider.tsx";
import { Tabs } from "../../../../../components/ui/index.ts";
import { ApprovalsPanel } from "./RequestPanels.tsx";
import { CalendarPanel } from "./CalendarPanel.tsx";

type Tab = "calendar" | "approvals";

/** Novo RH → Ausências (Fase 5): calendário e pedidos para aprovar. */
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
        ]}
      />
      {tab === "calendar" && <CalendarPanel />}
      {tab === "approvals" && <ApprovalsPanel />}
    </div>
  );
}
