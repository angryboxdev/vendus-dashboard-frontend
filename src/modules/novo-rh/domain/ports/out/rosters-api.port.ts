import type { Publication, PublishOptions, Roster, RosterCandidates, RosterShift, RosterSummary, ShiftInput, ShiftState, ShiftTemplate, Swap, Violation, WorkArea, CoverageReport, CoverageRule } from "../../entities/rosters.ts";

/** Escalas (`/api/novo-rh/rosters`) e o meu horário (`/api/me/roster`). */
export interface RostersApiPort {
  listTemplates(): Promise<ShiftTemplate[]>;
  createTemplate(input: Omit<ShiftTemplate, "id" | "archived">): Promise<ShiftTemplate>;
  archiveTemplate(id: string): Promise<void>;
  /** Editar: nunca usado → no lugar; usado → nova versão (`versioned`), o que já está feito fica no antigo. */
  updateTemplate(id: string, input: Omit<ShiftTemplate, "id" | "archived" | "used">): Promise<{ template: ShiftTemplate; versioned: boolean }>;
  /** Áreas de trabalho (com `locationId`: só as desse centro); inclui desativadas. */
  listAreas(locationId?: string | null): Promise<WorkArea[]>;
  createArea(input: { locationId: string; name: string }): Promise<WorkArea>;
  updateArea(id: string, patch: { name?: string; sortOrder?: number; active?: boolean }): Promise<WorkArea>;
  /** Plano de Cobertura (opcional por empresa). */
  coverageStatus(): Promise<{ enabled: boolean }>;
  /** Ligar/desligar nas Escalas (vale para a empresa a partir de hoje; desligar mantém os mínimos). */
  setCoverageEnabled(enabled: boolean): Promise<{ enabled: boolean }>;
  listCoverageRules(locationId: string): Promise<CoverageRule[]>;
  createCoverageRule(input: Omit<CoverageRule, "id">): Promise<CoverageRule>;
  updateCoverageRule(id: string, patch: { start?: string; end?: string; minPeople?: number }): Promise<CoverageRule>;
  deleteCoverageRule(id: string): Promise<void>;
  /** Planeado vs. publicado do centro da escala no período (desligado → `enabled: false`). */
  coverage(rosterId: string, from: string, to: string): Promise<CoverageReport>;
  /** Só a cor do modelo (null = automática). */
  setTemplateColor(id: string, color: string | null): Promise<ShiftTemplate>;
  listRosters(): Promise<Roster[]>;
  /** Visão macro: escalas com pessoas, por publicar e última publicação no período. */
  summary(from: string, to: string): Promise<RosterSummary[]>;
  createRoster(input: Pick<Roster, "name" | "targetType" | "targetId">): Promise<Roster>;
  listShifts(rosterId: string, from: string, to: string): Promise<{ roster: Roster; pending: number; shifts: RosterShift[] }>;
  addShift(rosterId: string, input: ShiftInput): Promise<{ shift: RosterShift; warnings: Violation[] }>;
  assignBulk(rosterId: string, input: { employeeIds: string[]; from: string; to: string; weekdays: string[]; kind: "shift" | "day_off"; templateId: string | null; areaId?: string | null }): Promise<{ created: number; warnings: Violation[] }>;
  updateShift(id: string, patch: Partial<ShiftInput>, opts: PublishOptions): Promise<{ shift: RosterShift; warnings: Violation[]; publication: Publication | null }>;
  deleteShift(id: string, opts: PublishOptions): Promise<{ publication: Publication | null }>;
  /** Limpa numa só operação os turnos nunca publicados de um colaborador no período (opcionalmente só estes ids). */
  clearPending(rosterId: string, input: { employeeId: string; from: string; to: string; shiftIds?: string[] }): Promise<{ removed: RosterShift[] }>;
  /** Repõe turnos pendentes retirados (desfazer). */
  restoreShifts(rosterId: string, shiftIds: string[]): Promise<{ restored: RosterShift[]; warnings: Violation[] }>;
  /** Com período: só os pendentes desse período (os outros continuam a contar nas regras). */
  check(rosterId: string, period?: { from: string; to: string }): Promise<{ pending: number; violations: Violation[] }>;
  candidates(rosterId: string, from: string, to: string): Promise<RosterCandidates>;
  publish(rosterId: string, opts: PublishOptions): Promise<Publication>;
  history(rosterId: string): Promise<Publication[]>;
  listSwaps(status?: Swap["status"]): Promise<Swap[]>;
  decideSwap(id: string, decision: "approve" | "reject", comment: string | null, confirm: boolean): Promise<Swap>;
  myRoster(from: string, to: string): Promise<{ employeeId: string; shifts: (ShiftState & { id: string; rosterId: string })[] }>;
  mySwaps(): Promise<Swap[]>;
  requestSwap(input: { shiftId: string; targetEmployeeId: string; counterShiftId: string | null; comment: string | null }): Promise<Swap>;
  respondSwap(id: string, accept: boolean): Promise<Swap>;
}
