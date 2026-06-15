import type { CashClosing } from "../../domain/entities/cash-closing.ts";
import type { ListClosingsPort, ListClosingsQuery } from "../../domain/ports/in/list-closings.port.ts";
import type { CashClosingApiPort } from "../../domain/ports/out/cash-closing-api.port.ts";

export class ListClosingsUseCase implements ListClosingsPort {
  private readonly api: CashClosingApiPort;
  constructor(api: CashClosingApiPort) {
    this.api = api;
  }

  async execute(query: ListClosingsQuery): Promise<{ closings: CashClosing[]; total: number }> {
    return this.api.listClosings(query);
  }
}
