import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ProductMappingChange } from "../../domain/entities/food-cost.ts";
import { useDeliveryPlatformsModule } from "../../delivery-platforms.module.tsx";
import { STATEMENTS_KEY } from "./use-delivery-platforms.ts";

const message = (err: unknown, fallback: string) => (err instanceof Error ? err.message : fallback);

/** Custo da comida do mês e gravação das correções (refaz o custo e a margem). */
export function useFoodCost(year: number, month: number) {
  const { getFoodCost, saveProductMappings } = useDeliveryPlatformsModule();
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: [STATEMENTS_KEY, "food-cost", year, month],
    queryFn: () => getFoodCost.execute(year, month),
    retry: false,
  });
  const save = useMutation({
    mutationFn: (changes: ProductMappingChange[]) => saveProductMappings.execute(changes),
    onSuccess: () => void qc.invalidateQueries({ queryKey: [STATEMENTS_KEY] }),
  });
  return {
    foodCost: query.data ?? null,
    loading: query.isLoading,
    error: query.error ? message(query.error, "Erro ao calcular o custo da comida") : null,
    saving: save.isPending,
    saveError: save.error ? message(save.error, "Erro ao gravar") : null,
    saveChange: (change: ProductMappingChange) => save.mutate([change]),
  };
}
