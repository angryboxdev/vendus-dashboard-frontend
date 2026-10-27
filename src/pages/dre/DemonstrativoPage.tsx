import { CashFlowProvider } from "../../modules/cash-flow/cash-flow.module.tsx";
import { DreView } from "../../modules/cash-flow/adapters/in/DreView.tsx";
import { useDrePeriod } from "./DrePeriodContext";

/** Mapa de rentabilidade → Mapa: DRE pela conciliação bancária (módulo `cash-flow`), com o período do seletor do Mapa. */
export function DemonstrativoPage() {
  const { period } = useDrePeriod();
  return (
    <CashFlowProvider>
      <DreView year={period.year} month={period.month} />
    </CashFlowProvider>
  );
}
