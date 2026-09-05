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
import { LocationCredentialsProvider } from "../../location-credentials.module.tsx";
import type { LocationCredentialsModule } from "../../location-credentials.module.tsx";
import { PairingRedemptionForm } from "./PairingRedemptionForm.tsx";

function buildTestModule(
  codes: Parameters<typeof InMemoryLocationCredentialsApiAdapter.withSeed>[0] = {},
): LocationCredentialsModule {
  const api = InMemoryLocationCredentialsApiAdapter.withSeed(codes);
  const storage = new InMemoryDeviceTokenStorageAdapter();
  return {
    generatePairingCode: new GeneratePairingCodeUseCase(api),
    listActiveTokens: new ListActiveTokensUseCase(api),
    revokeToken: new RevokeTokenUseCase(api),
    redeemPairingCode: new RedeemPairingCodeUseCase(api, storage),
    getPairingStatus: new GetPairingStatusUseCase(storage, api),
  };
}

async function typeAndSubmit(user: ReturnType<typeof userEvent.setup>, code: string) {
  await user.type(screen.getByPlaceholderText("XXXXXXXX"), code);
  await user.click(screen.getByRole("button", { name: /emparelhar/i }));
}

describe("PairingRedemptionForm", () => {
  it("shows 'código inválido' for a malformed code", async () => {
    const user = userEvent.setup();
    const onRedeemed = vi.fn();
    render(
      <LocationCredentialsProvider module={buildTestModule()}>
        <PairingRedemptionForm onRedeemed={onRedeemed} />
      </LocationCredentialsProvider>,
    );
    await typeAndSubmit(user, "bad");
    await waitFor(() => expect(screen.getByText("Código inválido.")).toBeInTheDocument());
    expect(onRedeemed).not.toHaveBeenCalled();
  });

  it("shows 'código não encontrado' for an unknown code", async () => {
    const user = userEvent.setup();
    const onRedeemed = vi.fn();
    render(
      <LocationCredentialsProvider module={buildTestModule()}>
        <PairingRedemptionForm onRedeemed={onRedeemed} />
      </LocationCredentialsProvider>,
    );
    await typeAndSubmit(user, "ZZZZZZZZ");
    await waitFor(() => expect(screen.getByText("Código não encontrado.")).toBeInTheDocument());
    expect(onRedeemed).not.toHaveBeenCalled();
  });

  it("shows 'código já utilizado' for an already-used code", async () => {
    const user = userEvent.setup();
    const onRedeemed = vi.fn();
    render(
      <LocationCredentialsProvider
        module={buildTestModule({ codes: [{ code: "USEDCODE", locationId: "loc-1", status: "used" }] })}
      >
        <PairingRedemptionForm onRedeemed={onRedeemed} />
      </LocationCredentialsProvider>,
    );
    await typeAndSubmit(user, "USEDCODE");
    await waitFor(() => expect(screen.getByText("Código já utilizado.")).toBeInTheDocument());
    expect(onRedeemed).not.toHaveBeenCalled();
  });

  it("shows 'código expirado' for an expired code", async () => {
    const user = userEvent.setup();
    const onRedeemed = vi.fn();
    render(
      <LocationCredentialsProvider
        module={buildTestModule({ codes: [{ code: "EXPIRED1", locationId: "loc-1", status: "expired" }] })}
      >
        <PairingRedemptionForm onRedeemed={onRedeemed} />
      </LocationCredentialsProvider>,
    );
    await typeAndSubmit(user, "EXPIRED1");
    await waitFor(() => expect(screen.getByText("Código expirado, peça um novo.")).toBeInTheDocument());
    expect(onRedeemed).not.toHaveBeenCalled();
  });

  it("calls onRedeemed for a valid code", async () => {
    const user = userEvent.setup();
    const onRedeemed = vi.fn();
    render(
      <LocationCredentialsProvider
        module={buildTestModule({ codes: [{ code: "VALID123", locationId: "loc-1", status: "valid" }] })}
      >
        <PairingRedemptionForm onRedeemed={onRedeemed} />
      </LocationCredentialsProvider>,
    );
    await typeAndSubmit(user, "VALID123");
    await waitFor(() => expect(onRedeemed).toHaveBeenCalledTimes(1));
  });
});
