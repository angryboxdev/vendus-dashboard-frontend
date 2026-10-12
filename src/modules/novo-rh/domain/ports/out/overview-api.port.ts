import type { Overview } from "../../entities/overview.ts";

export interface OverviewApiPort {
  /** Painel de um dia (hoje se `date` for omitido). */
  get(date?: string): Promise<Overview>;
}
