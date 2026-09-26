import { createContext, useContext, type ReactNode } from "react";
import { HttpHrApiAdapter } from "./adapters/out/http-hr-api.adapter.ts";
import type { HrApiPort } from "./domain/ports/out/hr-api.port.ts";

export interface HrModule {
  api: HrApiPort;
}

function buildModule(): HrModule {
  return { api: new HttpHrApiAdapter() };
}

const HrContext = createContext<HrModule | null>(null);

export function HrProvider({ children, module: mod }: { children: ReactNode; module?: HrModule }) {
  const value = mod ?? buildModule();
  return <HrContext.Provider value={value}>{children}</HrContext.Provider>;
}

export function useHrModule(): HrModule {
  const ctx = useContext(HrContext);
  if (!ctx) throw new Error("useHrModule must be used inside HrProvider");
  return ctx;
}
