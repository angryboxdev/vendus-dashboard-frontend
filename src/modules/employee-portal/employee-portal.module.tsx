import { createContext, useContext, useMemo, type ReactNode } from "react";
import { HttpPortalApiAdapter } from "./adapters/out/http-portal-api.adapter.ts";
import { BrowserGeolocationAdapter } from "./adapters/out/browser-geolocation.adapter.ts";
import { GetPortalHomeUseCase, RegisterPunchUseCase } from "./application/use-cases/portal.use-cases.ts";
import type { GetPortalHomePort, RegisterPunchPort } from "./domain/ports/in/portal.ports.ts";

export interface EmployeePortalModule {
  getHome: GetPortalHomePort;
  registerPunch: RegisterPunchPort;
  /** Nova chave de idempotência por intenção de picagem. */
  newIdempotencyKey: () => string;
}

/** Composition root — o único sítio que conhece os adapters concretos (nos testes entram fakes). */
function buildModule(): EmployeePortalModule {
  const api = new HttpPortalApiAdapter();
  const geolocation = new BrowserGeolocationAdapter();
  return {
    getHome: new GetPortalHomeUseCase(api),
    registerPunch: new RegisterPunchUseCase(api, geolocation),
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
