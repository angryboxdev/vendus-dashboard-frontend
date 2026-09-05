import { useCallback, useEffect, useState } from "react";
import { useLocationCredentialsModule } from "../../location-credentials.module.tsx";

type PairingState = "checking" | "paired" | "unpaired";

export function useDevicePairing() {
  const { getPairingStatus } = useLocationCredentialsModule();
  const [state, setState] = useState<PairingState>("checking");

  useEffect(() => {
    let cancelled = false;
    getPairingStatus.execute().then((status) => {
      if (!cancelled) setState(status.paired ? "paired" : "unpaired");
    });
    return () => {
      cancelled = true;
    };
  }, [getPairingStatus]);

  const markPaired = useCallback(() => setState("paired"), []);

  return { state, markPaired };
}
