import { AlertBanner, EmptyState, PAGE_BG, Skeleton } from "../../../../components/ui/index.ts";
import { monthShort } from "../../domain/services/cash-flow-view.ts";
import { CashFlowChartCard } from "./CashFlowChartCard.tsx";
import { CashFlowSidePanel } from "./CashFlowSidePanel.tsx";
import { ExpenseCategoriesCard } from "./ExpenseCategoriesCard.tsx";
import { useCashFlow } from "./use-cash-flow.ts";

/** Fluxo de caixa do mês, só a partir do banco (entradas vs saídas de todas as contas). */
export function CashFlowView({ year, month }: { year: number; month: number }) {
  const { report, loading, error, future } = useCashFlow(year, month);

  return (
    <div className={`${PAGE_BG} mx-auto w-full max-w-6xl space-y-5 p-4 sm:p-6`}>
      {future ? (
        <EmptyState title="Este mês ainda não começou" description="Escolha um mês até ao atual." />
      ) : error ? (
        <AlertBanner tone="danger" title="Não foi possível carregar o fluxo de caixa">
          {error}
        </AlertBanner>
      ) : loading || !report ? (
        <div className="grid gap-5 lg:grid-cols-3" aria-busy="true">
          <Skeleton className="h-[30rem] lg:col-span-2" />
          <Skeleton className="h-[30rem]" />
          <Skeleton className="h-64 lg:col-span-3" />
        </div>
      ) : (
        <>
          <div className="grid gap-5 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <CashFlowChartCard report={report} />
            </div>
            <CashFlowSidePanel report={report} />
          </div>
          <ExpenseCategoriesCard
            categories={report.categories}
            totalCents={report.totals.outflowCents}
            prevMonth={monthShort(report.period.month === 1 ? 12 : report.period.month - 1)}
          />
        </>
      )}
    </div>
  );
}
