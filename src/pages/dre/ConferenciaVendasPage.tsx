import { CashFlowProvider } from "../../modules/cash-flow/cash-flow.module.tsx";
import { SalesReconciliationView } from "../../modules/cash-flow/adapters/in/SalesReconciliationView.tsx";
import { useDrePeriod } from "./DrePeriodContext";

/** Mapa de rentabilidade → Conferência de vendas (módulo `cash-flow`), com o período do seletor do Mapa. */
export function ConferenciaVendasPage() {
  const { period } = useDrePeriod();
  return (
    <CashFlowProvider>
      <SalesReconciliationView year={period.year} month={period.month} />
    </CashFlowProvider>
  );
}
