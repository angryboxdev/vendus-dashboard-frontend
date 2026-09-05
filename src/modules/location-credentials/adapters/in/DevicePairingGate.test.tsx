import { useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import {
  InMemoryLocationCredentialsApiAdapter,
  type SeededTokenCheck,
} from "../out/in-memory-location-credentials-api.adapter.ts";
import { InMemoryDeviceTokenStorageAdapter } from "../out/in-memory-device-token-storage.adapter.ts";
import { GeneratePairingCodeUseCase } from "../../application/use-cases/generate-pairing-code.use-case.ts";
import { ListActiveTokensUseCase } from "../../application/use-cases/list-active-tokens.use-case.ts";
import { RevokeTokenUseCase } from "../../application/use-cases/revoke-token.use-case.ts";
import { RedeemPairingCodeUseCase } from "../../application/use-cases/redeem-pairing-code.use-case.ts";
import { GetPairingStatusUseCase } from "../../application/use-cases/get-pairing-status.use-case.ts";
import { LocationCredentialsProvider } from "../../location-credentials.module.tsx";
import type { LocationCredentialsModule } from "../../location-credentials.module.tsx";
import { DevicePairingGate } from "./DevicePairingGate.tsx";

function buildTestModule(
  codes: Parameters<typeof InMemoryLocationCredentialsApiAdapter.withSeed>[0] = {},
  tokenSeed: string | null = null,
  tokenCheck: SeededTokenCheck = "valid",
): LocationCredentialsModule {
  const api = InMemoryLocationCredentialsApiAdapter.withSeed({ ...codes, tokenCheck });
  const storage = new InMemoryDeviceTokenStorageAdapter(tokenSeed);
  return {
    generatePairingCode: new GeneratePairingCodeUseCase(api),
    listActiveTokens: new ListActiveTokensUseCase(api),
    revokeToken: new RevokeTokenUseCase(api),
    redeemPairingCode: new RedeemPairingCodeUseCase(api, storage),
    getPairingStatus: new GetPairingStatusUseCase(storage, api),
  };
}

function Child() {
  const [count, setCount] = useState(0);
  return (
    <div>
      <span data-testid="count">{count}</span>
      <button onClick={() => setCount((c) => c + 1)}>inc</button>
    </div>
  );
}

function Harness({ module: mod }: { module: LocationCredentialsModule }) {
  const [, setTick] = useState(0);
  return (
    <LocationCredentialsProvider module={mod}>
      <button onClick={() => setTick((t) => t + 1)}>force-rerender</button>
      <DevicePairingGate>
        <Child />
      </DevicePairingGate>
    </LocationCredentialsProvider>
  );
}

describe("DevicePairingGate", () => {
  it("shows the pairing form when no token is stored", async () => {
    render(<Harness module={buildTestModule({}, null)} />);
    await waitFor(() => expect(screen.getByPlaceholderText("XXXXXXXX")).toBeInTheDocument());
  });

  it("renders children once the stored token is confirmed valid by the server, never flashing the form", async () => {
    render(<Harness module={buildTestModule({}, "existing-token", "valid")} />);
    await waitFor(() => expect(screen.getByTestId("count")).toBeInTheDocument());
    expect(screen.queryByPlaceholderText("XXXXXXXX")).not.toBeInTheDocument();
  });

  it("shows the pairing form when the stored token is revoked", async () => {
    render(<Harness module={buildTestModule({}, "revoked-token", "invalid")} />);
    await waitFor(() => expect(screen.getByPlaceholderText("XXXXXXXX")).toBeInTheDocument());
    expect(screen.queryByTestId("count")).not.toBeInTheDocument();
  });

  it("flips to children after redeeming, without remounting the child on further re-renders", async () => {
    const user = userEvent.setup();
    render(
      <Harness
        module={buildTestModule({ codes: [{ code: "VALID123", locationId: "loc-1", status: "valid" }] }, null)}
      />,
    );

    await waitFor(() => expect(screen.getByPlaceholderText("XXXXXXXX")).toBeInTheDocument());
    await user.type(screen.getByPlaceholderText("XXXXXXXX"), "VALID123");
    await user.click(screen.getByRole("button", { name: /emparelhar/i }));

    await waitFor(() => expect(screen.getByTestId("count")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "inc" }));
    expect(screen.getByTestId("count")).toHaveTextContent("1");

    await user.click(screen.getByRole("button", { name: "force-rerender" }));
    expect(screen.getByTestId("count")).toHaveTextContent("1");
  });
});
