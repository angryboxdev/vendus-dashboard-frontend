import { vi } from "vitest";
import type { NovoRhModule } from "./novo-rh.module.tsx";
import type { QueuedPunch } from "./domain/entities/attendance.ts";
import type { PunchQueueStoragePort } from "./domain/ports/out/attendance-api.port.ts";
import { PunchQueue } from "./domain/services/attendance.service.ts";

/** Fila offline em memória (testes). */
export function memoryQueue(): PunchQueueStoragePort & { items: QueuedPunch[] } {
  const q = {
    items: [] as QueuedPunch[],
    load: () => [...q.items],
    save: (items: QueuedPunch[]) => {
      q.items = [...items];
    },
  };
  return q;
}

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
    people: {
      list: none(),
      get: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      deactivate: vi.fn(),
      reactivate: vi.fn(),
      transfer: vi.fn(),
      exportCsv: vi.fn(),
      importCsv: vi.fn(),
      listContracts: none(),
      createContract: vi.fn(),
      cancelContract: vi.fn(),
      listManagers: none(),
      addManager: vi.fn(),
      endManager: vi.fn(),
      listCompensations: none(),
      assignCompensation: vi.fn(),
      endCompensation: vi.fn(),
      getCustomValues: none(),
      setCustomValues: vi.fn(),
      listAgreements: none(),
      createAgreement: vi.fn(),
      archiveAgreement: vi.fn(),
      listCompensationItems: none(),
      createCompensationItem: vi.fn(),
      deactivateCompensationItem: vi.fn(),
      listCustomFields: none(),
      createCustomField: vi.fn(),
      archiveCustomField: vi.fn(),
    },
    time: {
      listSchedules: none(),
      createSchedule: vi.fn(),
      addVersion: vi.fn(),
      archiveSchedule: vi.fn(),
      listHolidayCalendars: none(),
      createHolidayCalendar: vi.fn(),
      addHoliday: vi.fn(),
      updateHoliday: vi.fn(),
      removeHoliday: vi.fn(),
      importNational: vi.fn(),
      listVacationCalendars: none(),
      createVacationCalendar: vi.fn(),
      deletePreview: vi.fn(),
      deleteCalendar: vi.fn(),
      listAssignments: none(),
      assign: vi.fn(),
      endAssignment: vi.fn(),
      theoretical: vi.fn(),
    },
    attendance: {
      days: vi.fn(),
      revise: vi.fn(),
      corrections: none(),
      decide: vi.fn(),
      incidents: none(),
      resolveIncident: vi.fn(),
      adjustments: none(),
      recalculate: vi.fn(),
    },
    myClock: { status: vi.fn(), punch: vi.fn(), days: vi.fn(), refuse: vi.fn(), corrections: none(), requestCorrection: vi.fn() },
    punchQueue: new PunchQueue(memoryQueue(), () => `id-${Math.random().toString(36).slice(2)}`),
    ...over,
  };
}
