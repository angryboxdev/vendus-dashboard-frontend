import { createContext, useContext, useMemo, type ReactNode } from "react";
import { apiGet } from "../../lib/api.ts";
import { HttpPortalApiAdapter } from "./adapters/out/http-portal-api.adapter.ts";
import { HttpNovoRhPortalApiAdapter } from "./adapters/out/http-novo-rh-portal-api.adapter.ts";
import { ModeAwarePortalApiAdapter, type PortalSource } from "./adapters/out/mode-aware-portal-api.adapter.ts";
import { BrowserGeolocationAdapter } from "./adapters/out/browser-geolocation.adapter.ts";
import { GetPortalHomeUseCase, PortalSelfServiceUseCase, RegisterPunchUseCase } from "./application/use-cases/portal.use-cases.ts";
import type { GetPortalHomePort, PortalEngagementPort, PortalSelfServicePort, RegisterPunchPort } from "./domain/ports/in/portal.ports.ts";
import { HttpPortalEngagementApiAdapter } from "./adapters/out/http-portal-engagement-api.adapter.ts";
import { PortalEngagementUseCase } from "./application/use-cases/portal-engagement.use-cases.ts";

export interface EmployeePortalModule {
  getHome: GetPortalHomePort;
  registerPunch: RegisterPunchPort;
  selfService: PortalSelfServicePort;
  /** Comunicados, documentos enviados, tarefas, solicitações, quem está e banco de horas (Novo RH, onda 6). */
  engagement: PortalEngagementPort;
  /** Nova chave de idempotência por intenção de picagem. */
  newIdempotencyKey: () => string;
}

/** Composition root — o único sítio que conhece os adapters concretos (nos testes entram fakes). */
function buildModule(): EmployeePortalModule {
  const legacy = new HttpPortalApiAdapter();
  // Portal ligado ao Novo RH (Fase 2): a fonte vem do interruptor por organização/centro.
  const api = new ModeAwarePortalApiAdapter(legacy, new HttpNovoRhPortalApiAdapter(legacy), async () => (await apiGet<{ source: PortalSource }>("/api/me/portal-mode")).source);
  const geolocation = new BrowserGeolocationAdapter();
  return {
    getHome: new GetPortalHomeUseCase(api),
    registerPunch: new RegisterPunchUseCase(api, geolocation),
    selfService: new PortalSelfServiceUseCase(api),
    engagement: new PortalEngagementUseCase(new HttpPortalEngagementApiAdapter()),
    newIdempotencyKey: () => crypto.randomUUID(),
  };
}

const EmployeePortalContext = createContext<EmployeePortalModule | null>(null);

export function EmployeePortalProvider({ children, module: mod }: { children: ReactNode; module?: EmployeePortalModule }) {
  const value = useMemo(() => mod ?? buildModule(), [mod]);
  return <EmployeePortalContext.Provider value={value}>{children}</EmployeePortalContext.Provider>;
}

export function useEmployeePortalModule(): EmployeePortalModule {
  const ctx = useContext(EmployeePortalContext);
  if (!ctx) throw new Error("useEmployeePortalModule must be used inside EmployeePortalProvider");
  return ctx;
}
