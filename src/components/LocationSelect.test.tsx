import type { Session } from "@supabase/supabase-js";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { InMemoryLocationsApiAdapter } from "../modules/locations/adapters/out/in-memory-locations-api.adapter.ts";
import { ListLocationsUseCase } from "../modules/locations/application/use-cases/list-locations.use-case.ts";
import type { LocationDTO } from "../modules/locations/domain/entities/location.ts";
import type { LocationsModule } from "../modules/locations/locations.module.tsx";

const mockGetSession = vi.fn();
vi.mock("../lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: () => mockGetSession(),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
    },
  },
}));

// Imported after the mocks so they pick up the mocked modules.
const { AuthProvider } = await import("../contexts/AuthContext.tsx");
const { LocationsProvider } = await import("../modules/locations/locations.module.tsx");
const { LocationSelect } = await import("./LocationSelect.tsx");

function encodeSegment(claims: Record<string, unknown>): string {
  return btoa(JSON.stringify(claims)).replace(/\+/g, "-").replace(/\//g, "_");
}

function sessionWithOrg(): Session {
  return {
    access_token: `header.${encodeSegment({ org_role: "manager", org_id: "org-1" })}.signature`,
    user: { id: "user-1", email: "user@example.com" },
  } as unknown as Session;
}

function buildTestModule(seed: LocationDTO[]): LocationsModule {
  return { listLocations: new ListLocationsUseCase(InMemoryLocationsApiAdapter.withSeed(seed)) };
}

function Probe() {
  const [value, setValue] = useState<string | null>(null);
  return <LocationSelect value={value} onChange={setValue} />;
}

async function renderWithLocations(locations: LocationDTO[]) {
  mockGetSession.mockResolvedValue({ data: { session: sessionWithOrg() } });
  render(
    <AuthProvider>
      <LocationsProvider module={buildTestModule(locations)}>
        <Probe />
      </LocationsProvider>
    </AuthProvider>,
  );
}

const LOC_A: LocationDTO = { id: "loc-a", name: "Loja Centro", code: "CTR", timezone: "Europe/Lisbon", isActive: true };
const LOC_B: LocationDTO = { id: "loc-b", name: "Loja Norte", code: "NRT", timezone: "Europe/Lisbon", isActive: true };

describe("LocationSelect", () => {
  it("renders nothing when the organization has a single location", async () => {
    await renderWithLocations([LOC_A]);
    await waitFor(() => expect(screen.queryByRole("combobox")).not.toBeInTheDocument());
  });

  it("renders nothing when the organization has no locations yet", async () => {
    await renderWithLocations([]);
    await waitFor(() => expect(screen.queryByRole("combobox")).not.toBeInTheDocument());
  });

  it("renders a picker listing every active location when there is more than one", async () => {
    await renderWithLocations([LOC_A, LOC_B]);
    await waitFor(() => expect(screen.getByRole("combobox")).toBeInTheDocument());
    expect(screen.getByRole("option", { name: "Loja Centro" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Loja Norte" })).toBeInTheDocument();
  });

  it("lets the user choose a location when there are several", async () => {
    const user = userEvent.setup();
    await renderWithLocations([LOC_A, LOC_B]);
    const select = await screen.findByRole("combobox");
    await user.selectOptions(select, "loc-b");
    expect((select as HTMLSelectElement).value).toBe("loc-b");
  });
});
