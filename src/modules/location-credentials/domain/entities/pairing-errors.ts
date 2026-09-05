export class InvalidPairingCodeError extends Error {
  constructor() {
    super("Invalid pairing code");
    this.name = "InvalidPairingCodeError";
  }
}

export class PairingCodeNotFoundError extends Error {
  constructor() {
    super("Pairing code not found");
    this.name = "PairingCodeNotFoundError";
  }
}

export class PairingCodeAlreadyUsedError extends Error {
  constructor() {
    super("Pairing code already used");
    this.name = "PairingCodeAlreadyUsedError";
  }
}

export class PairingCodeExpiredError extends Error {
  constructor() {
    super("Pairing code expired");
    this.name = "PairingCodeExpiredError";
  }
}
