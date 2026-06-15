import { describe, expect, it } from "vitest";
import type { AuthPort } from "../../domain/ports/out/auth.port.ts";
import type { SidebarUser } from "../../domain/entities/sidebar-user.ts";
import { GetNavStateUseCase } from "./get-nav-state.use-case.ts";
import { SignOutUseCase } from "./sign-out.use-case.ts";

class FakeAuth implements AuthPort {
  signedOut = false;
  constructor(private readonly user: SidebarUser | null = null) {}
  getUser() {
    return this.user;
  }
  async signOut() {
    this.signedOut = true;
  }
}

describe("GetNavStateUseCase", () => {
  it("returns empty state when no user is authenticated", () => {
    const uc = new GetNavStateUseCase(new FakeAuth(null));
    const state = uc.execute("/");
    expect(state.tree).toHaveLength(0);
    expect(state.activeGroupId).toBeNull();
    expect(state.user).toBeNull();
  });

  it("returns nav tree for authenticated user", () => {
    const uc = new GetNavStateUseCase(
      new FakeAuth({ email: "a@b.com", role: "manager" }),
    );
    const state = uc.execute("/");
    expect(state.tree.length).toBeGreaterThan(0);
    expect(state.user?.email).toBe("a@b.com");
  });

  it("excludes admin link for non-admin users", () => {
    const uc = new GetNavStateUseCase(
      new FakeAuth({ email: "a@b.com", role: "manager" }),
    );
    const { tree } = uc.execute("/");
    expect(
      tree.some((e) => e.kind === "item" && e.path === "/admin/users"),
    ).toBe(false);
  });

  it("includes admin link for admin users", () => {
    const uc = new GetNavStateUseCase(
      new FakeAuth({ email: "a@b.com", role: "admin" }),
    );
    const { tree } = uc.execute("/");
    expect(
      tree.some((e) => e.kind === "item" && e.path === "/admin/users"),
    ).toBe(true);
  });

  it("resolves activeGroupId from current path", () => {
    const uc = new GetNavStateUseCase(
      new FakeAuth({ email: "a@b.com", role: "manager" }),
    );
    expect(uc.execute("/dre/demonstrativo").activeGroupId).toBe("dre");
    expect(uc.execute("/cash-closings").activeGroupId).toBeNull();
  });
});

describe("SignOutUseCase", () => {
  it("delegates to auth.signOut()", async () => {
    const auth = new FakeAuth({ email: "a@b.com", role: "manager" });
    await new SignOutUseCase(auth).execute();
    expect(auth.signedOut).toBe(true);
  });
});
