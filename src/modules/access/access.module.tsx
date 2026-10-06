import { createContext, useContext, useMemo, type ReactNode } from "react";
import { HttpAccessApiAdapter } from "./adapters/out/http-access-api.adapter.ts";
import type { AccessApiPort } from "./domain/ports/out/access-api.port.ts";

export interface AccessModule {
  /**
   * As operações deste módulo são leituras/escritas diretas de recursos do
   * backend, sem orquestração no cliente — os ecrãs usam a porta através
   * dos hooks de `adapters/in` (mesmo padrão do módulo `hr`). As regras de
   * apresentação vivem em `domain/services/access-ui.service.ts`.
   */
  api: AccessApiPort;
}

/** Composition root — o único sítio que conhece o adapter concreto (nos testes entra um fake). */
function buildModule(): AccessModule {
  return { api: new HttpAccessApiAdapter() };
}

const AccessContext = createContext<AccessModule | null>(null);

export function AccessProvider({ children, module: mod }: { children: ReactNode; module?: AccessModule }) {
  const value = useMemo(() => mod ?? buildModule(), [mod]);
  return <AccessContext.Provider value={value}>{children}</AccessContext.Provider>;
}

export function useAccessModule(): AccessModule {
  const ctx = useContext(AccessContext);
  if (!ctx) throw new Error("useAccessModule must be used inside AccessProvider");
  return ctx;
}
