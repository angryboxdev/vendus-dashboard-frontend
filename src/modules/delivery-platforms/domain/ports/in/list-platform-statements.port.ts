import type { PlatformStatementSummary } from "../../entities/platform-statement.ts";

/** Extratos cujo período toca o mês. */
export interface ListPlatformStatementsPort {
  execute(year: number, month: number): Promise<PlatformStatementSummary[]>;
}
