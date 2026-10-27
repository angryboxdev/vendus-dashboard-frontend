import { useQuery } from "@tanstack/react-query";
import type { DreReport } from "../../domain/entities/dre.ts";
import { isFutureMonth } from "../../domain/services/cash-flow-view.ts";
import { useCashFlowModule } from "../../cash-flow.module.tsx";

export interface UseDreResult {
  report: DreReport | null;
  loading: boolean;
  error: string | null;
  /** O mês ainda não começou: não há nada para pedir. */
  future: boolean;
}

export function useDre(year: number, month: number): UseDreResult {
  const { getDre } = useCashFlowModule();
  const future = isFutureMonth(year, month, new Date());
  const query = useQuery({
    queryKey: ["dre", year, month],
    queryFn: () => getDre.execute(year, month),
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
