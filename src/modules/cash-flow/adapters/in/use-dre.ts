import { useQuery } from "@tanstack/react-query";
import type { DreReport, DreRestaurantSales } from "../../domain/entities/dre.ts";
import { isFutureMonth } from "../../domain/services/cash-flow-view.ts";
import { useCashFlowModule } from "../../cash-flow.module.tsx";

export interface UseDreResult {
  /** Custos, plataformas e IVA do banco (DRE rápida, sem o restaurante); null até chegar. */
  costs: DreReport | null;
  /** Vendas do restaurante (Vendus); null até chegar. */
  sales: DreRestaurantSales | null;
  costsLoading: boolean;
  salesLoading: boolean;
  costsError: string | null;
  salesError: string | null;
  /** O mês ainda não começou: não há nada para pedir. */
  future: boolean;
}

const message = (e: unknown) => (e instanceof Error ? e.message : "Erro ao carregar");

/**
 * Dois pedidos independentes, em paralelo: os custos do banco (segundos) e as vendas do restaurante
 * (Vendus — até um minuto na primeira abertura do mês). Cada um aparece logo que chega, por qualquer ordem.
 */
export function useDre(year: number, month: number): UseDreResult {
  const { getDre, getDreRestaurantSales } = useCashFlowModule();
  const future = isFutureMonth(year, month, new Date());
  const costs = useQuery({
    queryKey: ["dre", year, month, "costs"],
    queryFn: () => getDre.execute(year, month, false),
    enabled: !future,
    retry: false,
  });
  const sales = useQuery({
    queryKey: ["dre-sales", year, month],
    queryFn: () => getDreRestaurantSales.execute(year, month),
    enabled: !future,
    retry: false,
  });
  return {
    costs: costs.data ?? null,
    sales: sales.data ?? null,
    costsLoading: !future && costs.isLoading,
    salesLoading: !future && sales.isLoading,
    costsError: costs.error ? message(costs.error) : null,
    salesError: sales.error ? message(sales.error) : null,
    future,
  };
}
