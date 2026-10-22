import { useState } from "react";
import { useI18n } from "../../../../../i18n/I18nProvider.tsx";
import { SegmentedControl } from "../../../../../components/ui/index.ts";
import { AttendanceReportView } from "./AttendanceReportView.tsx";
import { ReportsView } from "./ReportsView.tsx";
import { TeamAnalyticsView } from "./TeamAnalyticsView.tsx";

type View = "attendance" | "team" | "catalog";

/** Mais → Relatórios: Assiduidade (por período e âmbito, Excel/PDF), Análise da equipa e o catálogo completo (CSV). */
export function ReportsHub() {
  const { t } = useI18n();
  const [view, setView] = useState<View>("attendance");
  return (
    <div className="space-y-4">
      <SegmentedControl<View>
        label={t("novoRh.tab.reports")}
        value={view}
        onChange={setView}
        items={[
          { key: "attendance", label: t("arep.tab") },
          { key: "team", label: "Análise da equipa" },
          { key: "catalog", label: t("novoRh.tab.reportsAll") },
        ]}
      />
      {view === "attendance" ? <AttendanceReportView /> : view === "team" ? <TeamAnalyticsView /> : <ReportsView />}
    </div>
  );
}
