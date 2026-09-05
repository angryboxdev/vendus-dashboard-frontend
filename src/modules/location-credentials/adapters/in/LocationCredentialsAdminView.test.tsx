import type { Session } from "@supabase/supabase-js";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { InMemoryLocationCredentialsApiAdapter } from "../out/in-memory-location-credentials-api.adapter.ts";
import { InMemoryDeviceTokenStorageAdapter } from "../out/in-memory-device-token-storage.adapter.ts";
import { GeneratePairingCodeUseCase } from "../../application/use-cases/generate-pairing-code.use-case.ts";
import { ListActiveTokensUseCase } from "../../application/use-cases/list-active-tokens.use-case.ts";
import { RevokeTokenUseCase } from "../../application/use-cases/revoke-token.use-case.ts";
import { RedeemPairingCodeUseCase } from "../../application/use-cases/redeem-pairing-code.use-case.ts";
import { GetPairingStatusUseCase } from "../../application/use-cases/get-pairing-status.use-case.ts";
import { InMemoryLocationsApiAdapter } from "../../../locations/adapters/out/in-memory-locations-api.adapter.ts";
import { ListLocationsUseCase } from "../../../locations/application/use-cases/list-locations.use-case.ts";
import type { LocationDTO } from "../../../locations/domain/entities/location.ts";
import type { LocationsModule } from "../../../locations/locations.module.tsx";
import type { LocationCredentialsModule } from "../../location-credentials.module.tsx";

const mockGetSession = vi.fn();
vi.mock("../../../../lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: () => mockGetSession(),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
    },
  },
}));

const { AuthProvider } = await import("../../../../contexts/AuthContext.tsx");
const { LocationsProvider } = await import("../../../locations/locations.module.tsx");
const { LocationCredentialsProvider } = await import("../../location-credentials.module.tsx");
const { LocationCredentialsAdminView } = await import("./LocationCredentialsAdminView.tsx");

function encodeSegment(claims: Record<string, unknown>): string {
  return btoa(JSON.stringify(claims)).replace(/\+/g, "-").replace(/\//g, "_");
}

function sessionWithOrg(): Session {
  return {
    access_token: `header.${encodeSegment({ org_role: "admin", org_id: "org-1" })}.signature`,
    user: { id: "user-1", email: "admin@example.com" },
  } as unknown as Session;
}

function buildLocationsModule(locations: LocationDTO[]): LocationsModule {
  return { listLocations: new ListLocationsUseCase(InMemoryLocationsApiAdapter.withSeed(locations)) };
}

function buildCredentialsModule(
  tokens: Record<string, { id: string; issuedAt: Date }[]> = {},
): LocationCredentialsModule {
  const api = InMemoryLocationCredentialsApiAdapter.withSeed({ tokens });
  const storage = new InMemoryDeviceTokenStorageAdapter();
  return {
    generatePairingCode: new GeneratePairingCodeUseCase(api),
    listActiveTokens: new ListActiveTokensUseCase(api),
    revokeToken: new RevokeTokenUseCase(api),
    redeemPairingCode: new RedeemPairingCodeUseCase(api, storage),
    getPairingStatus: new GetPairingStatusUseCase(storage),
  };
}

const LOC_A: LocationDTO = { id: "loc-a", name: "Loja Centro", code: "CTR", timezone: "Europe/Lisbon", isActive: true };
const LOC_B: LocationDTO = { id: "loc-b", name: "Loja Norte", code: "NRT", timezone: "Europe/Lisbon", isActive: true };

async function renderView(tokens: Record<string, { id: string; issuedAt: Date }[]> = {}) {
  mockGetSession.mockResolvedValue({ data: { session: sessionWithOrg() } });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <LocationsProvider module={buildLocationsModule([LOC_A, LOC_B])}>
          <LocationCredentialsProvider module={buildCredentialsModule(tokens)}>
            <LocationCredentialsAdminView />
          </LocationCredentialsProvider>
        </LocationsProvider>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

async function selectLocation(user: ReturnType<typeof userEvent.setup>, name: string) {
  const select = await screen.findByRole("combobox");
  await user.selectOptions(select, name);
}

describe("LocationCredentialsAdminView", () => {
  it("generates a pairing code and shows it with a countdown", async () => {
    const user = userEvent.setup();
    await renderView();
    await selectLocation(user, "Loja Centro");
    await user.click(screen.getByRole("button", { name: /gerar código/i }));
    await waitFor(() => expect(screen.getByText(/^GENRT\d{3}$/)).toBeInTheDocument());
    expect(screen.getByText(/Expira em \d{2}:\d{2}/)).toBeInTheDocument();
  });

  it("lists tokens scoped to the selected location", async () => {
    const user = userEvent.setup();
    await renderView({
      "loc-a": [{ id: "token-a1", issuedAt: new Date("2026-01-01T10:00:00Z") }],
      "loc-b": [{ id: "token-b1", issuedAt: new Date("2026-01-02T10:00:00Z") }],
    });

    await selectLocation(user, "Loja Centro");
    await waitFor(() => expect(screen.getByText("token-a1")).toBeInTheDocument());
    expect(screen.queryByText("token-b1")).not.toBeInTheDocument();

    await selectLocation(user, "Loja Norte");
    await waitFor(() => expect(screen.getByText("token-b1")).toBeInTheDocument());
    expect(screen.queryByText("token-a1")).not.toBeInTheDocument();
  });

  it("shows the empty state for a location with no paired devices", async () => {
    const user = userEvent.setup();
    await renderView();
    await selectLocation(user, "Loja Centro");
    await waitFor(() =>
      expect(screen.getByText("Nenhum dispositivo emparelhado nesta loja.")).toBeInTheDocument(),
    );
  });

  it("revoking a token removes it without affecting another location's list", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    await renderView({
      "loc-a": [{ id: "token-a1", issuedAt: new Date("2026-01-01T10:00:00Z") }],
      "loc-b": [{ id: "token-b1", issuedAt: new Date("2026-01-02T10:00:00Z") }],
    });

    await selectLocation(user, "Loja Centro");
    await waitFor(() => expect(screen.getByText("token-a1")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "Revogar" }));
    await waitFor(() =>
      expect(screen.getByText("Nenhum dispositivo emparelhado nesta loja.")).toBeInTheDocument(),
    );

    await selectLocation(user, "Loja Norte");
    await waitFor(() => expect(screen.getByText("token-b1")).toBeInTheDocument());
  });
});
