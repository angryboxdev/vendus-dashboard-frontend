import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { usePayableRecurrencesModule } from "../../payable-recurrences.module.tsx";
import { formatPeriod } from "../../domain/entities/recurrence.ts";
import { KpiCard } from "./KpiCard.tsx";
import { NewRecurrenceButton } from "./NewRecurrenceButton.tsx";
import { CategoryBreakdownCard } from "./CategoryBreakdownCard.tsx";
import { RecurrencesViewSwitch } from "./RecurrencesViewSwitch.tsx";
import { PageFooter } from "../../../../components/PageFooter.tsx";

function fromCents(n: number): string {
  return (n / 100).toLocaleString("pt-PT", { style: "currency", currency: "EUR" });
}

/** Vista predefinida da aba Recorrências: sem ano/mês no caminho, mostra o mês atual. */
export function RecurrencesMonthlyView() {
  const { year: yearParam, month: monthParam } = useParams<{ year: string; month: string }>();
  const navigate = useNavigate();
  const { api } = usePayableRecurrencesModule();

  const now = new Date();
  const year = yearParam ? parseInt(yearParam, 10) : now.getFullYear();
  const month = monthParam ? parseInt(monthParam, 10) : now.getMonth() + 1; // 1-based

  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;
  const isFutureMonth =
    year > now.getFullYear() || (year === now.getFullYear() && month > now.getMonth() + 1);

  const period = `${year}-${String(month).padStart(2, "0")}`;
  const enabled = Number.isInteger(year) && month >= 1 && month <= 12;

  const { data: summary, isLoading: loadingSummary } = useQuery({
    queryKey: ["payable-recurrences-monthly-summary", period],
    queryFn: () => api.getMonthlySummary(period),
    enabled,
  });

  const { data: occurrences = [], isLoading: loadingOccurrences } = useQuery({
    queryKey: ["payable-recurrences-occurrences-for-period", period],
    queryFn: () => api.listOccurrencesForPeriod(period),
    enabled,
  });

  const { data: recurrences = [] } = useQuery({
    queryKey: ["payable-recurrences"],
    queryFn: () => api.listRecurrences(),
  });
  const recurrenceById = new Map(recurrences.map((r) => [r.id, r]));

  function goToMonth(offset: number) {
    const d = new Date(year, month - 1 + offset, 1);
    navigate(`/financial/recurrences/monthly/${d.getFullYear()}/${d.getMonth() + 1}`);
  }

  const pendingValue =
    summary && summary.pendingCount === 0
      ? "0 — Todos concluídos"
      : `${summary?.pendingCount ?? 0} pagamentos por realizar`;

  const overdueValue =
    summary && summary.overdueCount === 0
      ? "0 — Nenhuma vencida"
      : `${summary?.overdueCount ?? 0} vencida${(summary?.overdueCount ?? 0) > 1 ? "s" : ""}`;

  const paidSub =
    summary?.paidVsForecastedPercent != null
      ? `${Math.abs(summary.paidVsForecastedPercent).toFixed(1).replace(".", ",")}% ${
          summary.paidVsForecastedPercent < 0 ? "abaixo" : "acima"
        } do previsto`
      : "Já reconciliado no banco";

  return (
    <div className="min-h-screen bg-[#FAF6F3]">
      <div className="border-b border-[#F5C992]/40 bg-white px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-stone-900">Recorrências &amp; Contratos</h1>
            <p className="mt-0.5 text-sm text-stone-500">KPIs e ocorrências de todas as recorrências para o mês</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <RecurrencesViewSwitch active="month" />
            <div className="flex items-center gap-1">
              <button
                onClick={() => goToMonth(-1)}
                className="rounded-md p-1 text-stone-400 hover:bg-stone-100"
              >
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
                </svg>
              </button>
              <span className="text-sm font-semibold text-stone-700 w-32 text-center capitalize">
                {formatPeriod(period)}
              </span>
              <button
                onClick={() => goToMonth(1)}
                disabled={isCurrentMonth || isFutureMonth}
                className="rounded-md p-1 text-stone-400 hover:bg-stone-100 disabled:opacity-30"
              >
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            <NewRecurrenceButton />
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {loadingSummary || !summary ? (
          <div className="py-16 text-center text-sm text-stone-400">A carregar…</div>
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
            <KpiCard label="Ativas" value={summary.activeRecurrencesCount} sub="Vigentes no mês" accentClass="text-emerald-700" />
            <KpiCard label="Previsto no mês" value={fromCents(summary.forecastedAmountCents)} sub="Estimado + faturado" />
            <KpiCard label="Pago no mês" value={fromCents(summary.paidAmountCents)} sub={paidSub} accentClass="text-emerald-700" />
            <KpiCard
              label="Pagamentos por realizar"
              value={pendingValue}
              accentClass={summary.pendingCount > 0 ? "text-amber-600" : "text-stone-800"}
            />
            <KpiCard
              label="Vencidas"
              value={overdueValue}
              accentClass={summary.overdueCount > 0 ? "text-red-600" : "text-stone-800"}
            />
          </div>
        )}

        {/* Valor do mês por categoria */}
        {loadingOccurrences ? (
          <div className="rounded-xl border border-[#F5C992]/40 bg-white py-12 text-center text-sm text-stone-400">A carregar…</div>
        ) : (
          <CategoryBreakdownCard occurrences={occurrences} recurrenceById={recurrenceById} />
        )}
      </div>

      <PageFooter />
    </div>
  );
}
