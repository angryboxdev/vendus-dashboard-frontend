import { I18nProvider } from "../../i18n/I18nProvider.tsx";
import { NovoRhHomeView } from "./adapters/in/NovoRhHomeView.tsx";

/**
 * Composition root do Novo RH. Fase 0: só a página de entrada, em pt-PT.
 * Os adapters HTTP (e o seletor real/demonstração) entram na Fase 1.
 */
export function NovoRhPage() {
  return (
    <I18nProvider locale="pt-PT">
      <NovoRhHomeView />
    </I18nProvider>
  );
}
