import { createContext, useContext, useMemo, type ReactNode } from "react";
import { HttpCrmWorkspaceApiAdapter } from "./adapters/out/http-crm-workspace-api.adapter.ts";
import { CrmWorkspaceService } from "./application/crm-workspace.service.ts";

const Context = createContext<CrmWorkspaceService | null>(null);
export function CrmProvider({ children, service }: { children: ReactNode; service?: CrmWorkspaceService }) {
  const defaultService = useMemo(() => new CrmWorkspaceService(new HttpCrmWorkspaceApiAdapter()), []);
  return <Context.Provider value={service ?? defaultService}>{children}</Context.Provider>;
}
export function useCrmWorkspace() {
  const service = useContext(Context); if (!service) throw new Error("useCrmWorkspace requer CrmProvider"); return service;
}
