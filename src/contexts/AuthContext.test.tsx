import type { Session } from "@supabase/supabase-js";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mockGetSession = vi.fn();
const mockOnAuthStateChange = vi.fn(() => ({
  data: { subscription: { unsubscribe: vi.fn() } },
}));

vi.mock("../lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: () => mockGetSession(),
      onAuthStateChange: () => mockOnAuthStateChange(),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
    },
  },
}));

// Imported after the mock so AuthContext picks up the mocked client.
const { AuthProvider, useAuth } = await import("./AuthContext");

function encodeSegment(claims: Record<string, unknown>): string {
  return btoa(JSON.stringify(claims))
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

/** Builds a fake session whose access_token carries the given JWT claims. */
function sessionWithClaims(claims: Record<string, unknown>): Session {
  return {
    access_token: `header.${encodeSegment(claims)}.signature`,
    user: { id: "user-1", email: "user@example.com" },
  } as unknown as Session;
}

function Probe() {
  const { user, loading } = useAuth();
  if (loading) return <div>loading</div>;
  return (
    <div>
      <div data-testid="role">{user?.role ?? "none"}</div>
      <div data-testid="org">{user?.organizationId ?? "null"}</div>
    </div>
  );
}

async function renderWithSession(session: Session | null) {
  mockGetSession.mockResolvedValue({ data: { session } });
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );
  await waitFor(() => expect(screen.queryByText("loading")).toBeNull());
}

describe("AuthProvider (tolerant claim reader)", () => {
  it("resolves the role from org_role (new claim shape)", async () => {
    await renderWithSession(sessionWithClaims({ org_role: "manager" }));
    expect(screen.getByTestId("role").textContent).toBe("manager");
  });

  it("falls back to app_role when org_role is absent (old claim shape)", async () => {
    await renderWithSession(sessionWithClaims({ app_role: "admin" }));
    expect(screen.getByTestId("role").textContent).toBe("admin");
  });

  it("prefers org_role over app_role when both are present", async () => {
    await renderWithSession(
      sessionWithClaims({ org_role: "hr_viewer", app_role: "admin" }),
    );
    expect(screen.getByTestId("role").textContent).toBe("hr_viewer");
  });

  it("populates the organization id from org_id", async () => {
    await renderWithSession(
      sessionWithClaims({ org_role: "manager", org_id: "org-42" }),
    );
    expect(screen.getByTestId("org").textContent).toBe("org-42");
  });

  it("leaves the organization id null on an old-shape token", async () => {
    await renderWithSession(sessionWithClaims({ app_role: "manager" }));
    expect(screen.getByTestId("org").textContent).toBe("null");
  });

  it("resolves no user when neither role claim is present", async () => {
    await renderWithSession(sessionWithClaims({ org_id: "org-42" }));
    expect(screen.getByTestId("role").textContent).toBe("none");
  });
});
