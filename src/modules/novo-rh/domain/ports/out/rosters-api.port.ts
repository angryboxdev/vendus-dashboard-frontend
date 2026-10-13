import type { Publication, PublishOptions, Roster, RosterShift, RosterSummary, ShiftInput, ShiftState, ShiftTemplate, Swap, Violation } from "../../entities/rosters.ts";

/** Escalas (`/api/novo-rh/rosters`) e o meu horário (`/api/me/roster`). */
export interface RostersApiPort {
  listTemplates(): Promise<ShiftTemplate[]>;
  createTemplate(input: Omit<ShiftTemplate, "id" | "archived">): Promise<ShiftTemplate>;
  archiveTemplate(id: string): Promise<void>;
  listRosters(): Promise<Roster[]>;
  /** Visão macro: escalas com pessoas, por publicar e última publicação no período. */
  summary(from: string, to: string): Promise<RosterSummary[]>;
  createRoster(input: Pick<Roster, "name" | "targetType" | "targetId">): Promise<Roster>;
  listShifts(rosterId: string, from: string, to: string): Promise<{ roster: Roster; pending: number; shifts: RosterShift[] }>;
  addShift(rosterId: string, input: ShiftInput): Promise<{ shift: RosterShift; warnings: Violation[] }>;
  assignBulk(rosterId: string, input: { employeeIds: string[]; from: string; to: string; weekdays: string[]; kind: "shift" | "day_off"; templateId: string | null }): Promise<{ created: number; warnings: Violation[] }>;
  updateShift(id: string, patch: Partial<ShiftInput>, opts: PublishOptions): Promise<{ shift: RosterShift; warnings: Violation[]; publication: Publication | null }>;
  deleteShift(id: string, opts: PublishOptions): Promise<{ publication: Publication | null }>;
  /** Limpa numa só operação os turnos nunca publicados de um colaborador no período (opcionalmente só estes ids). */
  clearPending(rosterId: string, input: { employeeId: string; from: string; to: string; shiftIds?: string[] }): Promise<{ removed: RosterShift[] }>;
  /** Repõe turnos pendentes retirados (desfazer). */
  restoreShifts(rosterId: string, shiftIds: string[]): Promise<{ restored: RosterShift[]; warnings: Violation[] }>;
  check(rosterId: string): Promise<{ pending: number; violations: Violation[] }>;
  publish(rosterId: string, opts: PublishOptions): Promise<Publication>;
  history(rosterId: string): Promise<Publication[]>;
  listSwaps(status?: Swap["status"]): Promise<Swap[]>;
  decideSwap(id: string, decision: "approve" | "reject", comment: string | null, confirm: boolean): Promise<Swap>;
  myRoster(from: string, to: string): Promise<{ employeeId: string; shifts: (ShiftState & { id: string; rosterId: string })[] }>;
  mySwaps(): Promise<Swap[]>;
  requestSwap(input: { shiftId: string; targetEmployeeId: string; counterShiftId: string | null; comment: string | null }): Promise<Swap>;
  respondSwap(id: string, accept: boolean): Promise<Swap>;
}
