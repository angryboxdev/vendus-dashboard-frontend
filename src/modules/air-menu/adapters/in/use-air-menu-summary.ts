import { useCallback, useEffect, useState } from "react";
import type { AirMenuOrder } from "../../domain/entities/air-menu-order.ts";
import type { AirMenuAnalyticsData } from "../../domain/entities/air-menu-analytics.ts";
import { useAirMenuModule } from "../../air-menu.module.tsx";

interface State {
  orders: AirMenuOrder[];
  analytics: AirMenuAnalyticsData | null;
  loading: boolean;
  error: string | null;
}

interface UseAirMenuSummaryResult extends State {
  refresh: () => Promise<void>;
}

export function useAirMenuSummary(
  enterpriseId: string | null,
  startDate: Date,
  endDate: Date,
): UseAirMenuSummaryResult {
  const { getSummary } = useAirMenuModule();

  const [state, setState] = useState<State>({
    orders: [],
    analytics: null,
    loading: false,
    error: null,
  });

  const startTime = startDate.getTime();
  const endTime = endDate.getTime();

  const load = useCallback(async () => {
    if (!enterpriseId) return;
    setState({ orders: [], analytics: null, loading: true, error: null });
    try {
      const { orders, analytics } = await getSummary.execute(
        enterpriseId,
        new Date(startTime),
        new Date(endTime),
      );
      setState({ orders, analytics, loading: false, error: null });
    } catch (err) {
      setState({
        orders: [],
        analytics: null,
        loading: false,
        error: err instanceof Error ? err.message : "Erro desconhecido",
      });
    }
  }, [getSummary, enterpriseId, startTime, endTime]);

  useEffect(() => {
    void load();
  }, [load]);

  return { ...state, refresh: load };
}
