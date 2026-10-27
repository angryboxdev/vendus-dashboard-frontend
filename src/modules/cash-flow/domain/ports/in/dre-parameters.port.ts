import type { DreParameters, ResolvedDreParameters } from "../../entities/dre.ts";

export interface GetDreParametersPort {
  execute(year: number, month: number): Promise<ResolvedDreParameters>;
}

export interface SaveDreParametersPort {
  execute(year: number, month: number, parameters: DreParameters): Promise<ResolvedDreParameters>;
}
