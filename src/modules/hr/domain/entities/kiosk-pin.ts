export const KIOSK_PIN_LENGTH = 4;

export class InvalidKioskPinError extends Error {
  constructor() {
    super(`O PIN deve ter exatamente ${KIOSK_PIN_LENGTH} dígitos`);
    this.name = "InvalidKioskPinError";
  }
}

export function assertValidKioskPin(pin: string): void {
  if (!/^\d{4}$/.test(pin)) throw new InvalidKioskPinError();
}
