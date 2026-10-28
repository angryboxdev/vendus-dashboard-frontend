import { DeliveryPlatformsProvider } from "../../modules/delivery-platforms/delivery-platforms.module.tsx";
import { DeliveryPlatformsView } from "../../modules/delivery-platforms/adapters/in/DeliveryPlatformsView.tsx";
import { useDrePeriod } from "./DrePeriodContext";

/** Mapa de rentabilidade → Plataformas de delivery (módulo `delivery-platforms`), com o período do seletor do Mapa. */
export function PlataformasPage() {
  const { period } = useDrePeriod();
  return (
    <DeliveryPlatformsProvider>
      <DeliveryPlatformsView year={period.year} month={period.month} />
    </DeliveryPlatformsProvider>
  );
}
