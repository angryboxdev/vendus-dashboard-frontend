import { useState } from "react";
import { useI18n } from "../../../../../i18n/I18nProvider.tsx";
import { Tabs } from "../../../../../components/ui/index.ts";
import { CorrectionsPanel } from "./CorrectionsPanel.tsx";
import { DaysPanel } from "./DaysPanel.tsx";
import { IncidentsPanel } from "./IncidentsPanel.tsx";
import { MyClockPanel } from "./MyClockPanel.tsx";

type Tab = "days" | "incidents" | "corrections" | "myClock";

/** Novo RH → Assiduidade (Fase 4). */
export function AttendanceView() {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>("days");
  return (
    <div className="space-y-4">
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { key: "days", label: t("att.tab.days") },
          { key: "incidents", label: t("att.tab.incidents") },
          { key: "corrections", label: t("att.tab.corrections") },
          { key: "myClock", label: t("att.tab.myClock") },
        ]}
      />
      {tab === "days" && <DaysPanel />}
      {tab === "incidents" && <IncidentsPanel />}
      {tab === "corrections" && <CorrectionsPanel />}
      {tab === "myClock" && <MyClockPanel />}
    </div>
  );
}
