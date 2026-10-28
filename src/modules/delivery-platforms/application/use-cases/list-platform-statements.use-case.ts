import type { PlatformStatementSummary } from "../../domain/entities/platform-statement.ts";
import type { ListPlatformStatementsPort } from "../../domain/ports/in/list-platform-statements.port.ts";
import type { DeliveryPlatformsApiPort } from "../../domain/ports/out/delivery-platforms-api.port.ts";

export class ListPlatformStatementsUseCase implements ListPlatformStatementsPort {
  private readonly api: DeliveryPlatformsApiPort;

  constructor(api: DeliveryPlatformsApiPort) {
    this.api = api;
  }

  execute(year: number, month: number): Promise<PlatformStatementSummary[]> {
    return this.api.listStatements(year, month);
  }
}
