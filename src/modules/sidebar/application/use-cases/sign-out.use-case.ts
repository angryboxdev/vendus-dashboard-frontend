import type { SignOutPort } from "../../domain/ports/in/sign-out.port.ts";
import type { AuthPort } from "../../domain/ports/out/auth.port.ts";

export class SignOutUseCase implements SignOutPort {
  private readonly auth: AuthPort;

  constructor(auth: AuthPort) {
    this.auth = auth;
  }

  async execute(): Promise<void> {
    await this.auth.signOut();
  }
}
