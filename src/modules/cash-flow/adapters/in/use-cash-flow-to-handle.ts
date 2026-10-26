import { useQuery } from "@tanstack/react-query";
import type { CashFlowToHandle } from "../../domain/entities/cash-flow.ts";
import { useCashFlowModule } from "../../cash-flow.module.tsx";

/** «Para tratar» (estado atual): null enquanto carrega, sem permissão ou com erro — o painel não aparece. */
export function useCashFlowToHandle(): CashFlowToHandle | null {
  const { getToHandle } = useCashFlowModule();
  const query = useQuery({
    queryKey: ["cash-flow-to-handle"],
    queryFn: () => getToHandle.execute(),
    retry: false,
  });
  return query.data ?? null;
}
