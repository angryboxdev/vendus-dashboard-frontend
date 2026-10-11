import { createContext, useContext, useState, type ReactNode } from "react";
import { Route, Routes } from "react-router-dom";
import { I18nProvider } from "../../i18n/I18nProvider.tsx";
import { HttpSettingsApiAdapter } from "./adapters/out/http-settings-api.adapter.ts";
import { SupabaseMfaAdapter } from "./adapters/out/supabase-mfa.adapter.ts";
import { MfaGate } from "./adapters/in/MfaGate.tsx";
import type { MfaPort } from "./domain/ports/out/mfa.port.ts";
import type { AccessGovernanceApiPort, AuditApiPort, NotificationsApiPort, StructureApiPort } from "./domain/ports/out/governance-api.port.ts";
import { HttpAccessGovernanceApiAdapter, HttpAuditApiAdapter, HttpNotificationsApiAdapter, HttpStructureApiAdapter } from "./adapters/out/http-governance-api.adapters.ts";
import { StructureView } from "./adapters/in/structure/StructureView.tsx";
import { AccessView } from "./adapters/in/access/AccessView.tsx";
import { AuditView } from "./adapters/in/audit/AuditView.tsx";
import { NotificationsBell } from "./adapters/in/NotificationsBell.tsx";
import { NovoRhHomeView } from "./adapters/in/NovoRhHomeView.tsx";
import { NovoRhLayout } from "./adapters/in/NovoRhLayout.tsx";
import { SettingsView } from "./adapters/in/settings/SettingsView.tsx";
import type { SettingsApiPort } from "./domain/ports/out/settings-api.port.ts";

export interface NovoRhModule {
  settings: SettingsApiPort;
  mfa: MfaPort;
  structure: StructureApiPort;
  access: AccessGovernanceApiPort;
  audit: AuditApiPort;
  notifications: NotificationsApiPort;
}

const NovoRhContext = createContext<NovoRhModule | null>(null);

/**
 * Composition root do Novo RH: o único sítio que conhece os adapters
 * concretos. Nos testes passa-se `module` com fakes.
 */
export function NovoRhProvider({ children, module: mod }: { children: ReactNode; module?: NovoRhModule }) {
  const [value] = useState<NovoRhModule>(
    () =>
      mod ?? {
        settings: new HttpSettingsApiAdapter(),
        mfa: new SupabaseMfaAdapter(),
        structure: new HttpStructureApiAdapter(),
        access: new HttpAccessGovernanceApiAdapter(),
        audit: new HttpAuditApiAdapter(),
        notifications: new HttpNotificationsApiAdapter(),
      },
  );
  return <NovoRhContext.Provider value={value}>{children}</NovoRhContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useNovoRh(): NovoRhModule {
  const ctx = useContext(NovoRhContext);
  if (!ctx) throw new Error("useNovoRh fora de NovoRhProvider");
  return ctx;
}

/** Rota `/hr/novo/*`: Visão geral | Configurações | Estrutura | Acessos | Auditoria. Só Admin e com MFA (TK-3). */
export function NovoRhPage() {
  return (
    <I18nProvider locale="pt-PT">
      <NovoRhProvider>
        <NovoRhLayout extraActions={<NotificationsBell />}>
          <MfaGate>
            <Routes>
              <Route index element={<NovoRhHomeView />} />
              <Route path="configuracoes" element={<SettingsView />} />
              <Route path="estrutura" element={<StructureView />} />
              <Route path="acessos" element={<AccessView />} />
              <Route path="auditoria" element={<AuditView />} />
            </Routes>
          </MfaGate>
        </NovoRhLayout>
      </NovoRhProvider>
    </I18nProvider>
  );
}
