import { useEffect, useState } from "react";
import type { DishCostingDTO } from "../../domain/entities/recipe-costing.ts";
import { useRecipeCostingModule } from "../../recipe-costing.module.tsx";

/**
 * Custo atual de um prato (por tamanho e por linha), relido sempre que `refreshKey`
 * muda — a ficha técnica passa uma chave das suas linhas para recalcular a cada alteração.
 */
export function useDishCosting(
  pizzaId: string,
  refreshKey: string,
): { dish: DishCostingDTO | null; error: string | null } {
  const { api } = useRecipeCostingModule();
  const [dish, setDish] = useState<DishCostingDTO | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .getReport()
      .then((report) => {
        if (cancelled) return;
        setDish(report.dishes.find((d) => d.pizzaId === pizzaId) ?? null);
        setError(null);
      })
      .catch((e: unknown) => {
        if (!cancelled)
          setError(
            e instanceof Error
              ? e.message
              : "Não foi possível calcular o custo.",
          );
      });
    return () => {
      cancelled = true;
    };
  }, [api, pizzaId, refreshKey]);

  return { dish, error };
}
