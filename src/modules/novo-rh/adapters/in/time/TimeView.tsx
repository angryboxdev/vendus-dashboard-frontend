import { useState } from "react";
import { useI18n } from "../../../../../i18n/I18nProvider.tsx";
import { Tabs } from "../../../../../components/ui/index.ts";
import { HolidaysPanel } from "./HolidaysPanel.tsx";
import { SchedulesPanel } from "./SchedulesPanel.tsx";
import { TheoreticalPanel } from "./TheoreticalPanel.tsx";
import { VacationPanel } from "./VacationPanel.tsx";

type Tab = "schedules" | "holidays" | "vacation" | "theoretical";

/** Novo RH → Tempo (Fase 3). */
export function TimeView() {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>("schedules");
  return (
    <div className="space-y-4">
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { key: "schedules", label: t("time.tab.schedules") },
          { key: "holidays", label: t("time.tab.holidays") },
          { key: "vacation", label: t("time.tab.vacation") },
          { key: "theoretical", label: t("time.tab.theoretical") },
        ]}
      />
      {tab === "schedules" && <SchedulesPanel />}
      {tab === "holidays" && <HolidaysPanel />}
      {tab === "vacation" && <VacationPanel />}
      {tab === "theoretical" && <TheoreticalPanel />}
    </div>
  );
}
