import { createContext, useContext, useState, type ReactNode } from "react";
import { Route, Routes } from "react-router-dom";
import { I18nProvider } from "../../i18n/I18nProvider.tsx";
import { HttpSettingsApiAdapter } from "./adapters/out/http-settings-api.adapter.ts";
import { SupabaseMfaAdapter } from "./adapters/out/supabase-mfa.adapter.ts";
import { MfaGate } from "./adapters/in/MfaGate.tsx";
import type { MfaPort } from "./domain/ports/out/mfa.port.ts";
import { NovoRhHomeView } from "./adapters/in/NovoRhHomeView.tsx";
import { NovoRhLayout } from "./adapters/in/NovoRhLayout.tsx";
import { SettingsView } from "./adapters/in/settings/SettingsView.tsx";
import type { SettingsApiPort } from "./domain/ports/out/settings-api.port.ts";

export interface NovoRhModule {
  settings: SettingsApiPort;
  mfa: MfaPort;
}

const NovoRhContext = createContext<NovoRhModule | null>(null);

/**
 * Composition root do Novo RH: o único sítio que conhece os adapters
 * concretos. Nos testes passa-se `module` com fakes.
 */
export function NovoRhProvider({ children, module: mod }: { children: ReactNode; module?: NovoRhModule }) {
  const [value] = useState<NovoRhModule>(() => mod ?? { settings: new HttpSettingsApiAdapter(), mfa: new SupabaseMfaAdapter() });
  return <NovoRhContext.Provider value={value}>{children}</NovoRhContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useNovoRh(): NovoRhModule {
  const ctx = useContext(NovoRhContext);
  if (!ctx) throw new Error("useNovoRh fora de NovoRhProvider");
  return ctx;
}

/** Rota `/hr/novo/*`: Visão geral | Configurações. Só Admin (access-ui.service) e com MFA (TK-3). */
export function NovoRhPage() {
  return (
    <I18nProvider locale="pt-PT">
      <NovoRhProvider>
        <NovoRhLayout>
          <MfaGate>
            <Routes>
              <Route index element={<NovoRhHomeView />} />
              <Route path="configuracoes" element={<SettingsView />} />
            </Routes>
          </MfaGate>
        </NovoRhLayout>
      </NovoRhProvider>
    </I18nProvider>
  );
}
