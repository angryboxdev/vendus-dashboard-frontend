import type { AuthPort } from "../../domain/ports/out/auth.port.ts";
import type { SidebarUser } from "../../domain/entities/sidebar-user.ts";

/**
 * Adapts the React AuthContext to the AuthPort interface.
 * Uses getter functions (closures over a ref) so the adapter instance
 * is stable while always reading the latest auth values.
 */
export class ReactAuthAdapter implements AuthPort {
  private readonly userGetter: () => SidebarUser | null;
  private readonly signOutFn: () => Promise<void>;

  constructor(
    userGetter: () => SidebarUser | null,
    signOutFn: () => Promise<void>,
  ) {
    this.userGetter = userGetter;
    this.signOutFn = signOutFn;
  }

  getUser(): SidebarUser | null {
    return this.userGetter();
  }

  async signOut(): Promise<void> {
    await this.signOutFn();
  }
}
