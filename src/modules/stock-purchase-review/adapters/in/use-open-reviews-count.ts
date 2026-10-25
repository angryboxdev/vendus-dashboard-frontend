import { useQuery } from "@tanstack/react-query";
import { useStockPurchaseReviewModule } from "../../stock-purchase-review.module.tsx";
import { OPEN_STOCK_PURCHASE_REVIEW_STATUSES } from "../../domain/entities/stock-purchase-review.ts";

/**
 * Nº de compras ainda por tratar (pending/in_review/partial/ready) — contador do
 * separador «Compras por rever» no Inventário. Mesma chave-base da listagem, para se
 * atualizar quando uma revisão é confirmada.
 */
export function useOpenReviewsCount(enabled: boolean): number | undefined {
  const { api } = useStockPurchaseReviewModule();
  const { data } = useQuery({
    queryKey: ["stock-purchase-reviews", "open-count"],
    queryFn: async () => (await api.listReviews({ view: "active" })).filter((r) => OPEN_STOCK_PURCHASE_REVIEW_STATUSES.includes(r.status)).length,
    enabled,
  });
  return enabled ? data : undefined;
}
