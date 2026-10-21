import { TeamPlanPanel } from "./TeamPlanPanel.tsx";

/** Novo RH → Assiduidade → Registos de ponto (Fase 3): só o planeado da equipa. */
export function TimeView() {
  return (
    <div className="space-y-4">
      <TeamPlanPanel />
    </div>
  );
}
