import type { ApplicationAudience, OccurrenceStatus, Weekday } from "./shift-template.ts";

/**
 * Automatização de turnos (RH 2.0, ticket 03) — espelho de
 * `shift-automation.ports.ts` do backend (`/api/hr/schedules/automations`).
 */
export type ShiftAutomationStatus = "active" | "paused";

export interface ShiftAutomation {
  id: string;
  name: string;
  description: string | null;
  kind: "weekly";
  templateId: string;
  templateName: string;
  audience: ApplicationAudience;
  locationId: string | null;
  weekdays: Weekday[];
  startDate: string;
  endDate: string | null;
  horizonWeeks: number;
  status: ShiftAutomationStatus;
  /** Último dia já gerado. */
  generatedUntil: string | null;
  lastRunAt: string | null;
  /** Ocorrências por resolver em "Alertas e ações". */
  openIssues: number;
  updatedAt: string;
}

export interface ShiftAutomationPayload {
  name: string;
  description: string | null;
  templateId: string;
  audience: ApplicationAudience;
  locationId: string | null;
  weekdays: Weekday[];
  startDate: string;
  endDate: string | null;
  horizonWeeks: number;
}

export interface AutomationGenerationResult {
  automationId: string;
  window: { from: string; to: string } | null;
  created: number;
  alreadyExisting: number;
  issues: number;
}

export interface AutomationIssue {
  id: string;
  automationId: string;
  automationName: string;
  employeeId: string;
  employeeName: string;
  workDate: string;
  status: OccurrenceStatus | "inactive_template";
}

export const HORIZON_OPTIONS = [1, 2, 4, 6, 8, 12] as const;
