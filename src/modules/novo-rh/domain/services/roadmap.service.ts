import type { RoadmapPhase } from "../entities/roadmap.ts";

/**
 * Estado atual das fases. Atualizar aqui quando uma fase passar o gate
 * (relatório aprovado) — é a fonte do ecrã "Novo RH".
 */
export const ROADMAP: RoadmapPhase[] = [
  { number: 0, status: "done" },
  { number: 1, status: "done" },
  { number: 2, status: "done" },
  { number: 3, status: "done" },
  { number: 4, status: "done" },
  { number: 5, status: "done" },
  { number: 6, status: "in_progress" },
  ...[7, 8, 9].map((number) => ({ number, status: "planned" as const })),
];

export function roadmapProgress(phases: RoadmapPhase[]): { done: number; total: number; current: RoadmapPhase | null } {
  return {
    done: phases.filter((p) => p.status === "done").length,
    total: phases.length,
    current: phases.find((p) => p.status === "in_progress") ?? phases.find((p) => p.status === "planned") ?? null,
  };
}
