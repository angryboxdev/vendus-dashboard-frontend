import { useState } from "react";
import { useI18n } from "../../../../../i18n/I18nProvider.tsx";
import { Tabs } from "../../../../../components/ui/index.ts";
import { CorrectionsPanel } from "./CorrectionsPanel.tsx";
import { DaysPanel } from "./DaysPanel.tsx";
import { IncidentsPanel } from "./IncidentsPanel.tsx";
import { BreakTypesPanel } from "./BreakTypesPanel.tsx";
import { TeamDayPanel } from "./TeamDayPanel.tsx";

type Tab = "team" | "days" | "incidents" | "corrections" | "breaks";

/** Novo RH → Assiduidade → Conferência (Fase 4). */
export function AttendanceView() {
  const { t } = useI18n();
  // Vindo do Painel com ?employeeId=… abre já os dias dessa pessoa; senão, o dia da equipa.
  const [tab, setTab] = useState<Tab>(() => (new URLSearchParams(window.location.search).get("employeeId") ? "days" : "team"));
  return (
    <div className="space-y-4">
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { key: "team", label: t("att.tab.team") },
          { key: "days", label: t("att.tab.days") },
          { key: "incidents", label: t("att.tab.incidents") },
          { key: "corrections", label: t("att.tab.corrections") },
          { key: "breaks", label: t("att.tab.breaks") },
        ]}
      />
      {tab === "team" && <TeamDayPanel />}
      {tab === "days" && <DaysPanel />}
      {tab === "incidents" && <IncidentsPanel />}
      {tab === "corrections" && <CorrectionsPanel />}
      {tab === "breaks" && <BreakTypesPanel />}
    </div>
  );
}
