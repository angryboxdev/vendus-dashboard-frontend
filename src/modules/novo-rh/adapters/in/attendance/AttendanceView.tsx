import { useState } from "react";
import { useI18n } from "../../../../../i18n/I18nProvider.tsx";
import { Button, DropdownMenu, IconChevronDown, IconChevronLeft } from "../../../../../components/ui/index.ts";
import { ConferencePanel } from "./conference/ConferencePanel.tsx";
import { CorrectionsPanel } from "./CorrectionsPanel.tsx";
import { DaysPanel } from "./DaysPanel.tsx";
import { IncidentsPanel } from "./IncidentsPanel.tsx";
import { BreakTypesPanel } from "./BreakTypesPanel.tsx";
import { TeamDayPanel } from "./TeamDayPanel.tsx";

type Other = "team" | "days" | "incidents" | "corrections" | "breaks";

/**
 * Novo RH → Assiduidade → Conferência. Desde a V2 (ADR-0043) a conferência
 * é Semana · Dia · Pendências com um só painel de revisão; as vistas
 * técnicas anteriores continuam acessíveis em «Outras vistas» (nada foi apagado).
 */
export function AttendanceView() {
  const { t } = useI18n();
  // Vindo do Painel com ?employeeId=… abre já os dias dessa pessoa.
  const [other, setOther] = useState<Other | null>(() => (new URLSearchParams(window.location.search).get("employeeId") ? "days" : null));
  const menu = (
    <DropdownMenu
      label="Outras vistas"
      items={[
        { label: t("att.tab.days"), onSelect: () => setOther("days") },
        { label: t("att.tab.team"), onSelect: () => setOther("team") },
        { label: t("att.tab.corrections"), onSelect: () => setOther("corrections") },
        { label: t("att.tab.incidents"), onSelect: () => setOther("incidents") },
        { label: t("att.tab.breaks"), onSelect: () => setOther("breaks") },
      ]}
      trigger={({ open, toggle }) => (
        <Button size="sm" variant="tertiary" aria-haspopup="menu" aria-expanded={open} onClick={toggle} icon={<IconChevronDown size={14} />}>
          Outras vistas
        </Button>
      )}
    />
  );
  if (!other) return <ConferencePanel extra={menu} onOpenCorrections={() => setOther("corrections")} />;
  return (
    <div className="space-y-4">
      <Button size="sm" variant="tertiary" icon={<IconChevronLeft size={14} />} onClick={() => setOther(null)}>
        Voltar à conferência
      </Button>
      {other === "team" && <TeamDayPanel />}
      {other === "days" && <DaysPanel />}
      {other === "incidents" && <IncidentsPanel />}
      {other === "corrections" && <CorrectionsPanel />}
      {other === "breaks" && <BreakTypesPanel />}
    </div>
  );
}
