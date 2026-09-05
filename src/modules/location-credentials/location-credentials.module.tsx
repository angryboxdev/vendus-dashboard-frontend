import { createContext, useContext, type ReactNode } from "react";
import { HttpLocationCredentialsApiAdapter } from "./adapters/out/http-location-credentials-api.adapter.ts";
import { LocalStorageDeviceTokenAdapter } from "./adapters/out/local-storage-device-token.adapter.ts";
import { GeneratePairingCodeUseCase } from "./application/use-cases/generate-pairing-code.use-case.ts";
import { ListActiveTokensUseCase } from "./application/use-cases/list-active-tokens.use-case.ts";
import { RevokeTokenUseCase } from "./application/use-cases/revoke-token.use-case.ts";
import { RedeemPairingCodeUseCase } from "./application/use-cases/redeem-pairing-code.use-case.ts";
import { GetPairingStatusUseCase } from "./application/use-cases/get-pairing-status.use-case.ts";
import type { GeneratePairingCodePort } from "./domain/ports/in/generate-pairing-code.port.ts";
import type { ListActiveTokensPort } from "./domain/ports/in/list-active-tokens.port.ts";
import type { RevokeTokenPort } from "./domain/ports/in/revoke-token.port.ts";
import type { RedeemPairingCodePort } from "./domain/ports/in/redeem-pairing-code.port.ts";
import type { GetPairingStatusPort } from "./domain/ports/in/get-pairing-status.port.ts";

export interface LocationCredentialsModule {
  generatePairingCode: GeneratePairingCodePort;
  listActiveTokens: ListActiveTokensPort;
  revokeToken: RevokeTokenPort;
  redeemPairingCode: RedeemPairingCodePort;
  getPairingStatus: GetPairingStatusPort;
}

function buildModule(): LocationCredentialsModule {
  const api = new HttpLocationCredentialsApiAdapter();
  const storage = new LocalStorageDeviceTokenAdapter();

  return {
    generatePairingCode: new GeneratePairingCodeUseCase(api),
    listActiveTokens: new ListActiveTokensUseCase(api),
    revokeToken: new RevokeTokenUseCase(api),
    redeemPairingCode: new RedeemPairingCodeUseCase(api, storage),
    getPairingStatus: new GetPairingStatusUseCase(storage),
  };
}

const LocationCredentialsContext = createContext<LocationCredentialsModule | null>(null);

export function LocationCredentialsProvider({
  children,
  module: mod,
}: {
  children: ReactNode;
  module?: LocationCredentialsModule;
}) {
  const value = mod ?? buildModule();
  return (
    <LocationCredentialsContext.Provider value={value}>
      {children}
    </LocationCredentialsContext.Provider>
  );
}

export function useLocationCredentialsModule(): LocationCredentialsModule {
  const ctx = useContext(LocationCredentialsContext);
  if (!ctx) {
    throw new Error("useLocationCredentialsModule must be used inside LocationCredentialsProvider");
  }
  return ctx;
}
