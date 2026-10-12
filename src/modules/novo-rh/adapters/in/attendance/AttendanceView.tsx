import { useState } from "react";
import { useI18n } from "../../../../../i18n/I18nProvider.tsx";
import { Tabs } from "../../../../../components/ui/index.ts";
import { CorrectionsPanel } from "./CorrectionsPanel.tsx";
import { DaysPanel } from "./DaysPanel.tsx";
import { IncidentsPanel } from "./IncidentsPanel.tsx";
import { MyClockPanel } from "./MyClockPanel.tsx";
import { BreakTypesPanel } from "./BreakTypesPanel.tsx";
import { ClockTypesPanel } from "./ClockTypesPanel.tsx";
import { TeamDayPanel } from "./TeamDayPanel.tsx";

type Tab = "team" | "days" | "incidents" | "corrections" | "breaks" | "clockTypes" | "myClock";

/** Novo RH → Assiduidade (Fase 4). */
export function AttendanceView() {
  const { t } = useI18n();
  // Vindo do Painel com ?employeeId=… abre já os dias dessa pessoa; senão, o dia da equipa.
  const [tab, setTab] = useState<Tab>(() => {
    const q = new URLSearchParams(window.location.search);
    // FE-003: o widget do cabeçalho abre direto "O meu ponto".
    if (q.get("tab") === "myClock") return "myClock";
    return q.get("employeeId") ? "days" : "team";
  });
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
          { key: "clockTypes", label: t("att.tab.clockTypes") },
          { key: "myClock", label: t("att.tab.myClock") },
        ]}
      />
      {tab === "team" && <TeamDayPanel />}
      {tab === "days" && <DaysPanel />}
      {tab === "incidents" && <IncidentsPanel />}
      {tab === "corrections" && <CorrectionsPanel />}
      {tab === "breaks" && <BreakTypesPanel />}
      {tab === "clockTypes" && <ClockTypesPanel />}
      {tab === "myClock" && <MyClockPanel />}
    </div>
  );
}
