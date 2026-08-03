import type { GetEnterprisesPort } from "../../domain/ports/in/get-enterprises.port.ts";
import type { AirMenuApiPort } from "../../domain/ports/out/air-menu-api.port.ts";
import type { AirMenuEnterprise } from "../../domain/entities/air-menu-enterprise.ts";

export class GetEnterprisesUseCase implements GetEnterprisesPort {
  private readonly api: AirMenuApiPort;

  constructor(api: AirMenuApiPort) {
    this.api = api;
  }

  execute(): Promise<AirMenuEnterprise[]> {
    return this.api.fetchEnterprises();
  }
}
