import { useCallback, useEffect, useState } from "react";
import type { VendusSelfConsumptionResult } from "../../domain/entities/vendus-selfconsumption.ts";
import { useVendusModule } from "../../vendus.module.tsx";

interface State {
  data: VendusSelfConsumptionResult | null;
  loading: boolean;
  error: string | null;
}

interface UseVendusSelfConsumptionResult extends State {
  refresh: () => Promise<void>;
}

export function useVendusSelfConsumption(
  since: string,
  until: string,
): UseVendusSelfConsumptionResult {
  const { getSelfConsumption } = useVendusModule();

  const [state, setState] = useState<State>({ data: null, loading: false, error: null });

  const load = useCallback(async () => {
    setState({ data: null, loading: true, error: null });
    try {
      const data = await getSelfConsumption.execute(since, until);
      setState({ data, loading: false, error: null });
    } catch (err) {
      setState({
        data: null,
        loading: false,
        error: err instanceof Error ? err.message : "Erro desconhecido",
      });
    }
  }, [getSelfConsumption, since, until]);

  useEffect(() => {
    void load();
  }, [load]);

  return { ...state, refresh: load };
}
