import type { Overview, TeamPlan } from "../../entities/overview.ts";

export interface OverviewApiPort {
  /** Painel de um dia (hoje se `date` for omitido). */
  get(date?: string): Promise<Overview>;
  /** Só hoje (sem a semana): o mesmo apuramento, muito mais leve — lista de Pessoas. */
  today(): Promise<Pick<Overview, "date" | "people">>;
  /** Horários planeados da equipa (até 14 dias). */
  plan(from: string, to: string): Promise<TeamPlan>;
}
