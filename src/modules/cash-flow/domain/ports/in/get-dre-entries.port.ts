import type { DreEntries } from "../../entities/dre.ts";

/** Os pagamentos por trás de cada rubrica da DRE; null sem permissão de Bancos (403). */
export interface GetDreEntriesPort {
  execute(year: number, month: number): Promise<DreEntries | null>;
}
