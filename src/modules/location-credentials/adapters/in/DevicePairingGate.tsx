import type { ReactNode } from "react";
import { useDevicePairing } from "./use-device-pairing.ts";
import { PairingRedemptionForm } from "./PairingRedemptionForm.tsx";

export function DevicePairingGate({ children }: { children: ReactNode }) {
  const { state, markPaired } = useDevicePairing();
  if (state === "checking") return null;
  if (state === "unpaired") return <PairingRedemptionForm onRedeemed={markPaired} />;
  return <>{children}</>;
}
