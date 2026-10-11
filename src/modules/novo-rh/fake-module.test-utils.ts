import { vi } from "vitest";
import type { NovoRhModule } from "./novo-rh.module.tsx";

/** Módulo Novo RH com todas as portas falsas (sobrepor só o que o teste usa). */
export function fakeNovoRhModule(over: Partial<NovoRhModule> = {}): NovoRhModule {
  const none = () => vi.fn(async () => []);
  return {
    settings: {} as NovoRhModule["settings"],
    mfa: { status: vi.fn(async () => ({ level: "aal2" as const, factorId: "f" })), enroll: vi.fn(), verify: vi.fn() },
    structure: {
      listDepartments: none(),
      createDepartment: vi.fn(),
      updateDepartment: vi.fn(),
      listGroups: none(),
      createGroup: vi.fn(),
      updateGroup: vi.fn(),
      listAssignments: none(),
      assign: vi.fn(),
      endAssignment: vi.fn(),
      listContacts: none(),
      setContact: vi.fn(),
      listTerms: none(),
      acceptTerms: vi.fn(),
    },
    access: {
      listProfiles: none(),
      listUsers: none(),
      profileGovernance: vi.fn(),
      setScopeKind: vi.fn(),
      setFieldPrivacy: vi.fn(),
      listScopes: none(),
      addScope: vi.fn(),
      endScope: vi.fn(),
      roleHistory: none(),
      downloadRoleHistoryCsv: vi.fn(),
    },
    audit: { list: none(), downloadCsv: vi.fn(), verify: vi.fn() },
    notifications: { list: none(), unreadCount: vi.fn(async () => 0), markRead: vi.fn(), markAllRead: vi.fn() },
    ...over,
  };
}
