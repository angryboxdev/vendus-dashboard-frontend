import { useQuery } from "@tanstack/react-query";
import type { CashFlowReport } from "../../domain/entities/cash-flow.ts";
import { isFutureMonth } from "../../domain/services/cash-flow-view.ts";
import { useCashFlowModule } from "../../cash-flow.module.tsx";

export interface UseCashFlowResult {
  report: CashFlowReport | null;
  loading: boolean;
  error: string | null;
  /** O mês ainda não começou: não há nada para pedir. */
  future: boolean;
}

export function useCashFlow(year: number, month: number): UseCashFlowResult {
  const { getCashFlow } = useCashFlowModule();
  const future = isFutureMonth(year, month, new Date());
  const query = useQuery({
    queryKey: ["cash-flow", year, month],
    queryFn: () => getCashFlow.execute(year, month),
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
