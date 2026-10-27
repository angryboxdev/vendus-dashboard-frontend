import { useQuery } from "@tanstack/react-query";
import type { DreReport } from "../../domain/entities/dre.ts";
import { isFutureMonth } from "../../domain/services/cash-flow-view.ts";
import { useCashFlowModule } from "../../cash-flow.module.tsx";

export interface UseDreResult {
  /** O relatório completo quando chega; até lá, o rápido (sem as vendas do restaurante). */
  report: DreReport | null;
  loading: boolean;
  /** Custos já à vista, vendas do restaurante (Vendus) ainda a carregar. */
  salesLoading: boolean;
  /** As vendas falharam mas os custos estão à vista. */
  salesError: string | null;
  /** Nada para mostrar. */
  error: string | null;
  /** O mês ainda não começou: não há nada para pedir. */
  future: boolean;
}

const message = (e: unknown) => (e instanceof Error ? e.message : "Erro ao carregar");

/**
 * Dois pedidos em paralelo: o rápido (banco, custos, plataformas — segundos) e o completo (com as
 * vendas do Vendus — até um minuto na primeira abertura do mês). Mostra o rápido até chegar o completo.
 */
export function useDre(year: number, month: number): UseDreResult {
  const { getDre } = useCashFlowModule();
  const future = isFutureMonth(year, month, new Date());
  const full = useQuery({
    queryKey: ["dre", year, month],
    queryFn: () => getDre.execute(year, month),
    enabled: !future,
    retry: false,
  });
  const quick = useQuery({
    queryKey: ["dre", year, month, "quick"],
    queryFn: () => getDre.execute(year, month, false),
    enabled: !future && !full.data,
    retry: false,
  });
  const report = full.data ?? quick.data ?? null;
  const fullError = full.error ? message(full.error) : null;
  return {
    report,
    loading: !future && !report && !fullError,
    salesLoading: !future && !full.data && !fullError && !!quick.data,
    salesError: report && fullError ? fullError : null,
    error: report ? null : fullError,
    future,
  };
}
