import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useStockCountModule } from "../../stock-count.module.tsx";
import { StockCountExecutionView } from "./StockCountExecutionView.tsx";
import { StockCountReviewView } from "./StockCountReviewView.tsx";

/**
 * Router fino: mostra a execução (rascunho/em contagem) ou a conferência
 * (em conferência/pronta/concluída/cancelada), consoante o estado da sessão.
 */
export function StockCountSessionDetailView() {
  const { id } = useParams<{ id: string }>();
  const { api } = useStockCountModule();

  const { data: session, isLoading, isError } = useQuery({
    queryKey: ["stock-count-session", id],
    queryFn: () => api.getSession(id!),
    enabled: !!id,
  });

  if (isLoading) return <div className="p-6 text-sm text-stone-400">A carregar…</div>;
  if (isError || !session) return <div className="p-6 text-sm text-stone-400">Não foi possível carregar esta contagem.</div>;

  if (session.status === "draft" || session.status === "counting") {
    return <StockCountExecutionView session={session} />;
  }
  return <StockCountReviewView session={session} />;
}
