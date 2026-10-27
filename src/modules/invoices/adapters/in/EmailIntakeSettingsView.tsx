import { PageShell, SURFACE } from "../../../../components/ui/index.ts";
import { EmailIntakePanel } from "./EmailIntakePanel.tsx";

/** Configurações → Integrações → Faturas por email: o mesmo painel de Faturas → Opções, numa página. */
export function EmailIntakeSettingsView() {
  return (
    <PageShell title="Faturas por email" description="Os fornecedores enviam as faturas para o endereço da empresa e elas entram para rever.">
      <div className={`${SURFACE} max-w-2xl p-5 sm:p-6`}>
        <EmailIntakePanel />
      </div>
    </PageShell>
  );
}
