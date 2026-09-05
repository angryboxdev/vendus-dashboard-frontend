import { useCallback, useState } from "react";
import { useLocationCredentialsModule } from "../../location-credentials.module.tsx";

type PairingState = "checking" | "paired" | "unpaired";

export function useDevicePairing() {
  const { getPairingStatus } = useLocationCredentialsModule();
  const [state, setState] = useState<PairingState>(() =>
    getPairingStatus.execute().paired ? "paired" : "unpaired",
  );

  const markPaired = useCallback(() => setState("paired"), []);

  return { state, markPaired };
}
