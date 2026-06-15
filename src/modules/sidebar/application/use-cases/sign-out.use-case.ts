import type { SignOutPort } from "../../domain/ports/in/sign-out.port.ts";
import type { AuthPort } from "../../domain/ports/out/auth.port.ts";

export class SignOutUseCase implements SignOutPort {
  constructor(private readonly auth: AuthPort) {}

  async execute(): Promise<void> {
    await this.auth.signOut();
  }
}
