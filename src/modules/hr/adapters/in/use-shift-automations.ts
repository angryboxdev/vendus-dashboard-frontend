import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ShiftAutomationPayload, ShiftAutomationStatus } from "../../domain/entities/shift-automation.ts";
import { useHrModule } from "../../hr.module.tsx";

export const SHIFT_AUTOMATIONS_QUERY_KEY = ["hr-shift-automations"];

/** Automatizações de turnos (RH 2.0, ticket 03). */
export function useShiftAutomations() {
  const { api } = useHrModule();
  return useQuery({ queryKey: SHIFT_AUTOMATIONS_QUERY_KEY, queryFn: () => api.listShiftAutomations() });
}

/** Mutações das automatizações; qualquer geração refresca também o calendário e os alertas. */
export function useManageShiftAutomations() {
  const { api } = useHrModule();
  const qc = useQueryClient();
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: SHIFT_AUTOMATIONS_QUERY_KEY });
    void qc.invalidateQueries({ queryKey: ["hr-work-shifts"] });
    void qc.invalidateQueries({ queryKey: ["hr-work-shifts-week-actions"] });
    void qc.invalidateQueries({ queryKey: ["hr-schedule-alerts"] });
  };

  const createMutation = useMutation({
    mutationFn: ({ payload, generateNow }: { payload: ShiftAutomationPayload; generateNow: boolean }) => api.createShiftAutomation(payload, generateNow),
    onSuccess: invalidate,
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<ShiftAutomationPayload> }) => api.updateShiftAutomation(id, payload),
    onSuccess: invalidate,
  });
  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ShiftAutomationStatus }) => api.setShiftAutomationStatus(id, status),
    onSuccess: invalidate,
  });
  const generateMutation = useMutation({
    mutationFn: ({ id, weeks }: { id: string; weeks?: number }) => api.generateShiftAutomation(id, weeks),
    onSuccess: invalidate,
  });
  const dismissMutation = useMutation({
    mutationFn: (issueId: string) => api.dismissAutomationIssue(issueId),
    onSuccess: invalidate,
  });

  return { createMutation, updateMutation, statusMutation, generateMutation, dismissMutation };
}
