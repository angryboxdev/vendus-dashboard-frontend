/** Plano por fases do Novo RH (task RH faseada §6). */
export type PhaseStatus = "done" | "in_progress" | "planned";

export interface RoadmapPhase {
  /** 0–9, igual ao número da fase na task. */
  number: number;
  status: PhaseStatus;
}

/** Modo de dados: organização real ou de demonstração (ADR-0034 do backend). */
export type DataMode = "real" | "demo";
