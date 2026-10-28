import type { DreEntries } from "../../domain/entities/dre.ts";
import type { GetDreEntriesPort } from "../../domain/ports/in/get-dre-entries.port.ts";
import type { CashFlowApiPort } from "../../domain/ports/out/cash-flow-api.port.ts";

export class GetDreEntriesUseCase implements GetDreEntriesPort {
  private readonly api: CashFlowApiPort;

  constructor(api: CashFlowApiPort) {
    this.api = api;
  }

  execute(year: number, month: number): Promise<DreEntries | null> {
    return this.api.getDreEntries(year, month);
  }
}
