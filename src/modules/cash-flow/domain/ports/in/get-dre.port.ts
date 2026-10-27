import type { DreReport } from "../../entities/dre.ts";

export interface GetDrePort {
  execute(year: number, month: number): Promise<DreReport>;
}
