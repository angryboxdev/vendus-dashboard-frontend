import { CashFlowProvider } from "../../modules/cash-flow/cash-flow.module.tsx";
import { ControleGeralView } from "../../modules/cash-flow/adapters/in/ControleGeralView.tsx";
import { useDrePeriod } from "./DrePeriodContext";

/** Mapa de rentabilidade → Controle geral (aberto pelo botão da DRE; sem entrada no menu), com o período do seletor do Mapa. */
export function ControleGeralPage() {
  const { period } = useDrePeriod();
  return (
    <CashFlowProvider>
      <ControleGeralView year={period.year} month={period.month} />
    </CashFlowProvider>
  );
}
