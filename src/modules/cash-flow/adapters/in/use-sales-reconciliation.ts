import { useQuery } from "@tanstack/react-query";
import type { SalesReconciliation } from "../../domain/entities/sales-reconciliation.ts";
import { isFutureMonth } from "../../domain/services/cash-flow-view.ts";
import { useCashFlowModule } from "../../cash-flow.module.tsx";

export interface UseSalesReconciliationResult {
  report: SalesReconciliation | null;
  loading: boolean;
  error: string | null;
  /** O mês ainda não começou: não há nada para pedir. */
  future: boolean;
}

export function useSalesReconciliation(year: number, month: number): UseSalesReconciliationResult {
  const { getSalesReconciliation } = useCashFlowModule();
  const future = isFutureMonth(year, month, new Date());
  const query = useQuery({
    queryKey: ["sales-reconciliation", year, month],
    queryFn: () => getSalesReconciliation.execute(year, month),
    enabled: !future,
    retry: false,
  });
  return {
    report: query.data ?? null,
    loading: !future && query.isLoading,
    error: query.error ? (query.error instanceof Error ? query.error.message : "Erro ao carregar") : null,
    future,
  };
}
