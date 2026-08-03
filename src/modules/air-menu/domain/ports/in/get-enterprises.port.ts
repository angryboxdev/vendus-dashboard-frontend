import type { AirMenuEnterprise } from "../../entities/air-menu-enterprise.ts";

export interface GetEnterprisesPort {
  execute(): Promise<AirMenuEnterprise[]>;
}
