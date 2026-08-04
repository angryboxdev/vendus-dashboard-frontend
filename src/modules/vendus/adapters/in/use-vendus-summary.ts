import { useCallback, useEffect, useState } from "react";
import type { VendusDetailedDocument } from "../../domain/entities/vendus-document.ts";
import type { VendusAnalytics } from "../../domain/entities/vendus-analytics.ts";
import { useVendusModule } from "../../vendus.module.tsx";

interface State {
  documents: VendusDetailedDocument[];
  analytics: VendusAnalytics | null;
  loading: boolean;
  error: string | null;
}

interface UseVendusSummaryResult extends State {
  refresh: () => Promise<void>;
}

export function useVendusSummary(
  since: string,
  until: string,
): UseVendusSummaryResult {
  const { getSummary } = useVendusModule();

  const [state, setState] = useState<State>({
    documents: [],
    analytics: null,
    loading: false,
    error: null,
  });

  const load = useCallback(async () => {
    setState({ documents: [], analytics: null, loading: true, error: null });
    try {
      const { documents, analytics } = await getSummary.execute(since, until);
      setState({ documents, analytics, loading: false, error: null });
    } catch (err) {
      setState({
        documents: [],
        analytics: null,
        loading: false,
        error: err instanceof Error ? err.message : "Erro desconhecido",
      });
    }
  }, [getSummary, since, until]);

  useEffect(() => {
    void load();
  }, [load]);

  return { ...state, refresh: load };
}
