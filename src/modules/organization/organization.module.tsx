import { createContext, useContext, type ReactNode } from "react";
import { HttpOrganizationApiAdapter } from "./adapters/out/http-organization-api.adapter.ts";
import {
  GetOrganizationProfileUseCase,
  ListOrganizationHistoryUseCase,
  UpdateOrganizationProfileUseCase,
  UploadOrganizationLogoUseCase,
} from "./application/use-cases/organization.use-cases.ts";
import type {
  GetOrganizationProfilePort,
  ListOrganizationHistoryPort,
  UpdateOrganizationProfilePort,
  UploadOrganizationLogoPort,
} from "./domain/ports/in/organization.ports.ts";
import type { OrganizationApiPort } from "./domain/ports/out/organization-api.port.ts";

export interface OrganizationModule {
  getProfile: GetOrganizationProfilePort;
  updateProfile: UpdateOrganizationProfilePort;
  uploadLogo: UploadOrganizationLogoPort;
  listHistory: ListOrganizationHistoryPort;
}

/**
 * Composition root — único sítio que conhece o adapter concreto. Nos testes
 * monta-se o `OrganizationModule` com `InMemoryOrganizationApiAdapter` e
 * passa-se por `module` ao provider (mesmo padrão de `tasks`).
 */
function buildModule(api: OrganizationApiPort = new HttpOrganizationApiAdapter()): OrganizationModule {
  return {
    getProfile: new GetOrganizationProfileUseCase(api),
    updateProfile: new UpdateOrganizationProfileUseCase(api),
    uploadLogo: new UploadOrganizationLogoUseCase(api),
    listHistory: new ListOrganizationHistoryUseCase(api),
  };
}

const OrganizationContext = createContext<OrganizationModule | null>(null);

export function OrganizationProvider({ children, module: mod }: { children: ReactNode; module?: OrganizationModule }) {
  const value = mod ?? buildModule();
  return <OrganizationContext.Provider value={value}>{children}</OrganizationContext.Provider>;
}

export function useOrganizationModule(): OrganizationModule {
  const ctx = useContext(OrganizationContext);
  if (!ctx) throw new Error("useOrganizationModule must be used inside OrganizationProvider");
  return ctx;
}
