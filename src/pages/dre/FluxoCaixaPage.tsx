import { CashFlowProvider } from "../../modules/cash-flow/cash-flow.module.tsx";
import { CashFlowView } from "../../modules/cash-flow/adapters/in/CashFlowView.tsx";
import { useDrePeriod } from "./DrePeriodContext";

/** Mapa de rentabilidade → Fluxo de caixa (módulo `cash-flow`), com o período do seletor do Mapa. */
export function FluxoCaixaPage() {
  const { period } = useDrePeriod();
  return (
    <CashFlowProvider>
      <CashFlowView year={period.year} month={period.month} />
    </CashFlowProvider>
  );
}
