import { useQuery } from "@tanstack/react-query";
import { useDeliveryPlatformsModule } from "../../delivery-platforms.module.tsx";
import { STATEMENTS_KEY } from "./use-delivery-platforms.ts";

/** Conferência das transferências do mês (refaz-se depois de cada importação). */
export function usePayoutReconciliation(year: number, month: number) {
  const { getPayoutReconciliation } = useDeliveryPlatformsModule();
  const query = useQuery({
    queryKey: [STATEMENTS_KEY, "payouts", year, month],
    queryFn: () => getPayoutReconciliation.execute(year, month),
    retry: false,
  });
  return {
    reconciliation: query.data ?? null,
    loading: query.isLoading,
    error: query.error ? (query.error instanceof Error ? query.error.message : "Erro ao conferir as transferências") : null,
  };
}
