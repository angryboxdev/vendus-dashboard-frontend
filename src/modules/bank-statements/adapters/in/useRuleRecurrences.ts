import { useQuery } from "@tanstack/react-query";
import { usePayableRecurrencesModule } from "../../../payable-recurrences/payable-recurrences.module.tsx";
import type { RecurrenceDTO } from "../../../payable-recurrences/domain/entities/recurrence.ts";

/**
 * Recorrências que um «movimento recorrente» pode pagar: não encerradas e sem fatura obrigatória (as que
 * exigem fatura concilia-se pela fatura, que paga a recorrência em cadeia).
 */
export function useRuleRecurrences(enabled = true): { recurrences: RecurrenceDTO[]; all: RecurrenceDTO[]; isLoading: boolean } {
  const api = usePayableRecurrencesModule().api;
  const { data = [], isLoading } = useQuery({
    queryKey: ["recurrences", "for-bank-rules"],
    queryFn: () => api.listRecurrences(),
    enabled,
    staleTime: 60_000,
  });
  const recurrences = data
    .filter((r) => r.status !== "closed" && !r.requireInvoice)
    .sort((a, b) => a.name.localeCompare(b.name, "pt"));
  return { recurrences, all: data, isLoading };
}

export function paymentPeriodHint(r: Pick<RecurrenceDTO, "paymentPeriodOffset"> | undefined): string {
  return r?.paymentPeriodOffset === -1
    ? "Cada pagamento paga o mês anterior (ex.: outubro paga setembro)."
    : "Cada pagamento paga o mês em que é feito.";
}
