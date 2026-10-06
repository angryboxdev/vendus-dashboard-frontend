import { assertValidKioskPin } from "../../domain/entities/kiosk-pin.ts";
import type { SetEmployeeKioskPinPort } from "../../domain/ports/in/set-employee-kiosk-pin.port.ts";
import type { HrApiPort } from "../../domain/ports/out/hr-api.port.ts";

export class SetEmployeeKioskPinUseCase implements SetEmployeeKioskPinPort {
  private readonly api: HrApiPort;
  constructor(api: HrApiPort) {
    this.api = api;
  }

  async execute(employeeId: string, pin: string): Promise<void> {
    assertValidKioskPin(pin);
    await this.api.setEmployeeKioskPin(employeeId, pin);
  }
}
