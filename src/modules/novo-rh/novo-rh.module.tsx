import { createContext, useContext, type ReactNode } from "react";
import { Route, Routes } from "react-router-dom";
import { I18nProvider } from "../../i18n/I18nProvider.tsx";
import { HttpSettingsApiAdapter } from "./adapters/out/http-settings-api.adapter.ts";
import { NovoRhHomeView } from "./adapters/in/NovoRhHomeView.tsx";
import { NovoRhLayout } from "./adapters/in/NovoRhLayout.tsx";
import { SettingsView } from "./adapters/in/settings/SettingsView.tsx";
import type { SettingsApiPort } from "./domain/ports/out/settings-api.port.ts";

export interface NovoRhModule {
  settings: SettingsApiPort;
}

const NovoRhContext = createContext<NovoRhModule | null>(null);

/**
 * Composition root do Novo RH: o único sítio que conhece os adapters
 * concretos. Nos testes passa-se `module` com fakes.
 */
export function NovoRhProvider({ children, module: mod }: { children: ReactNode; module?: NovoRhModule }) {
  const value = mod ?? { settings: new HttpSettingsApiAdapter() };
  return <NovoRhContext.Provider value={value}>{children}</NovoRhContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useNovoRh(): NovoRhModule {
  const ctx = useContext(NovoRhContext);
  if (!ctx) throw new Error("useNovoRh fora de NovoRhProvider");
  return ctx;
}

/** Rota `/hr/novo/*`: Visão geral | Configurações. Só Admin (access-ui.service). */
export function NovoRhPage() {
  return (
    <I18nProvider locale="pt-PT">
      <NovoRhProvider>
        <NovoRhLayout>
          <Routes>
            <Route index element={<NovoRhHomeView />} />
            <Route path="configuracoes" element={<SettingsView />} />
          </Routes>
        </NovoRhLayout>
      </NovoRhProvider>
    </I18nProvider>
  );
}
