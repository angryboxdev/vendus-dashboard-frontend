import type { DreParameters, ResolvedDreParameters } from "../../domain/entities/dre.ts";
import type { GetDreParametersPort, SaveDreParametersPort } from "../../domain/ports/in/dre-parameters.port.ts";
import type { CashFlowApiPort } from "../../domain/ports/out/cash-flow-api.port.ts";

export class GetDreParametersUseCase implements GetDreParametersPort {
  private readonly api: CashFlowApiPort;

  constructor(api: CashFlowApiPort) {
    this.api = api;
  }

  execute(year: number, month: number): Promise<ResolvedDreParameters> {
    return this.api.getDreParameters(year, month);
  }
}

export class SaveDreParametersUseCase implements SaveDreParametersPort {
  private readonly api: CashFlowApiPort;

  constructor(api: CashFlowApiPort) {
    this.api = api;
  }

  execute(year: number, month: number, parameters: DreParameters): Promise<ResolvedDreParameters> {
    return this.api.saveDreParameters(year, month, parameters);
  }
}
